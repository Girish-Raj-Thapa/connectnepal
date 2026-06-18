"""
Vectorizer service — runs the multi-step transform pipeline from the notebook.

Pipeline (mirrors notebook's transform_items_to_sparse + transform_sparse_to_dense):
  1. TF-IDF on combined_text          → weighted sparse
  2. OneHotEncoder on categoricals     → weighted sparse
  3. MultiLabelBinarizer per multi-val → weighted sparse
  4. StandardScaler on numerics        → weighted sparse
  5. hstack all sparse matrices
  6. TruncatedSVD → dense
  7. L2 normalize
"""

import logging

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix, hstack
from sklearn.preprocessing import normalize

from recommendations.services.artifact_loader import artifact_loader

logger = logging.getLogger('recommendations')

# Column lists matching the notebook's constants
CATEGORICAL_COLS = [
    'category_mapped',
    'activity_type_for_ohe',
    'difficulty_level_norm',
    'duration_type_mapped',
]

MULTI_VALUE_COLS = [
    'tags_list',
    'ideal_for_list',
    'best_seasons_list',
    'languages_offered_list',
]

NUMERIC_COLS = [
    'duration_days_filled',
    'duration_nights_filled',
    'average_duration_hours_filled',
    'max_group_size',
]


def _coerce_multi_value_cell(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, set):
        return list(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    if pd.isna(value):
        return []
    return [str(value)]


def _filter_unknown_multivalue_labels(df: pd.DataFrame, bundle) -> pd.DataFrame:
    """
    Drop multi-value labels that are not present in the artifact vocabulary.

    MultiLabelBinarizer emits runtime warnings for unknown classes. We filter
    them here so the serve path is quiet and the ignored values are visible via
    application logs instead of sklearn warnings.
    """
    filtered_df = df.copy()
    drift_summary = {}

    for col in MULTI_VALUE_COLS:
        binarizer = bundle.multilabel_binarizers[col]
        known_values = set(binarizer.classes_)

        filtered_values = []
        unknown_counts = {}

        for raw_values in filtered_df[col]:
            row_values = _coerce_multi_value_cell(raw_values)
            filtered_row = []

            for item in row_values:
                if item in known_values:
                    filtered_row.append(item)
                else:
                    unknown_counts[item] = unknown_counts.get(item, 0) + 1

            filtered_values.append(filtered_row)

        filtered_df[col] = filtered_values

        if unknown_counts:
            total_dropped = sum(unknown_counts.values())
            top_unknown = sorted(
                unknown_counts.items(),
                key=lambda pair: (-pair[1], pair[0]),
            )[:10]
            drift_summary[col] = {
                'dropped_count': total_dropped,
                'unique_unknown_count': len(unknown_counts),
                'top_unknown_values': top_unknown,
            }

    if drift_summary:
        logger.warning(
            "Recommendation vocabulary drift detected; unknown multi-value labels were dropped before vectorization: %s",
            drift_summary,
        )

    return filtered_df


def vectorize_listing(preprocessed: dict) -> np.ndarray:
    """
    Transform a single preprocessed listing dict into a dense vector.

    Returns a 1-D numpy array of shape (vector_dimension,).
    """
    return vectorize_batch([preprocessed])[0]


def vectorize_batch(preprocessed_list: list[dict]) -> list[np.ndarray]:
    """
    Transform a batch of preprocessed dicts into dense vectors.

    Runs the full notebook pipeline:
      sparse features → weighted concat → SVD projection → L2 norm

    Returns a list of 1-D numpy arrays.
    """
    if not preprocessed_list:
        return []

    bundle = artifact_loader.get_bundle()
    weights = bundle.feature_config.get('weights', {})

    df = pd.DataFrame(preprocessed_list)
    df = _filter_unknown_multivalue_labels(df, bundle)

    # ── Step 1: TF-IDF on combined_text ─────────────────────────────
    X_text = bundle.vectorizer.transform(df['combined_text'])
    X_text = X_text.multiply(weights.get('tfidf', 1.0))

    # ── Step 2: OneHotEncoder on categoricals ───────────────────────
    X_cat = bundle.categorical_encoder.transform(df[CATEGORICAL_COLS])
    X_cat = X_cat.multiply(weights.get('categorical', 0.8))

    # ── Step 3: MultiLabelBinarizer per multi-value column ──────────
    mlb_matrices = []
    for col in MULTI_VALUE_COLS:
        binarizer = bundle.multilabel_binarizers[col]
        matrix = binarizer.transform(df[col])
        mlb_matrices.append(matrix.multiply(weights.get('multi_value', 0.5)))

    # ── Step 4: StandardScaler on numerics ──────────────────────────
    X_num_dense = bundle.numeric_scaler.transform(df[NUMERIC_COLS].astype(float))
    X_num = csr_matrix(X_num_dense).multiply(weights.get('numeric', 0.3))

    # ── Step 5: Concatenate all sparse matrices ─────────────────────
    all_matrices = [X_text, X_cat] + mlb_matrices + [X_num]
    X_sparse = hstack(all_matrices, format='csr')

    # ── Step 6: TruncatedSVD → dense ────────────────────────────────
    X_dense = bundle.dense_projector.transform(X_sparse)

    # ── Step 7: L2 normalize ────────────────────────────────────────
    X_dense = normalize(X_dense, norm=bundle.normalization, axis=1)

    output = X_dense.astype(np.float32)

    # Validate dimension
    expected_dim = bundle.vector_dimension
    actual_dim = output.shape[1]
    if actual_dim != expected_dim:
        logger.warning(
            "Vector dimension mismatch: expected %d, got %d. "
            "Check artifact bundle alignment.",
            expected_dim, actual_dim,
        )

    vectors = [output[i] for i in range(output.shape[0])]

    logger.debug(
        "Vectorized %d items, dimension=%d",
        len(vectors), output.shape[1],
    )

    return vectors


def vectorize_query(preprocessed_query: dict) -> np.ndarray:
    """
    Transform a preprocessed traveller query payload into a dense query vector.

    Identical to vectorize_listing but named separately for clarity and to
    allow future divergence (e.g. query-side augmentation).
    """
    return vectorize_listing(preprocessed_query)
