import hashlib
import json
import logging
import threading
from pathlib import Path

import joblib
import sklearn
from django.conf import settings

logger = logging.getLogger('recommendations')


class ArtifactLoadError(Exception):
    """
    Raised when artifact loading or validation fails.
    """
    pass


class ArtifactBundle:
    """
    Immutable container for a loaded artifact bundle.

    The production_transform_bundle.pkl is a dict containing individual
    sklearn components (not a single ColumnTransformer). This class unpacks
    them into typed attributes for the vectorizer pipeline.

    Attributes:
        vectorizer: TfidfVectorizer fitted on combined_text.
        categorical_encoder: OneHotEncoder fitted on categorical columns.
        multilabel_binarizers: dict mapping column name -> MultiLabelBinarizer.
        numeric_scaler: StandardScaler fitted on numeric columns.
        dense_projector: TruncatedSVD for dimensionality reduction.
        manifest: Dict from artifact_manifest.json.
        preprocessing_contract: Dict from preprocessing_contract.json.
        feature_config: Dict from feature_config.json.
        mapping_config: Dict from mapping_config.json.
        version_label: The version label string.
        vector_dimension: The output vector dimensionality (e.g. 128).
        normalization: L2 normalization method string.
    """

    __slots__ = (
        'vectorizer',
        'categorical_encoder',
        'multilabel_binarizers',
        'numeric_scaler',
        'dense_projector',
        'manifest',
        'preprocessing_contract',
        'feature_config',
        'mapping_config',
        'version_label',
        'vector_dimension',
        'normalization',
        'sklearn_version',
        'artifact_hash',
    )

    def __init__(self, bundle_dict, manifest, preprocessing_contract, feature_config, mapping_config):
        # Unpack sklearn components from the bundle dict
        self.vectorizer = bundle_dict['vectorizer']
        self.categorical_encoder = bundle_dict['categorical_encoder']
        self.multilabel_binarizers = bundle_dict['multilabel_binarizers']
        self.numeric_scaler = bundle_dict['numeric_scaler']
        self.dense_projector = bundle_dict['dense_projector']

        self.manifest = manifest
        self.preprocessing_contract = preprocessing_contract
        self.feature_config = feature_config
        self.mapping_config = mapping_config

        # Version label: manifest uses 'artifact_version', not 'version_label'
        self.version_label = manifest.get('artifact_version', 'unknown')

        # Vector dimension: prefer bundle's value, fall back to manifest, then settings
        self.vector_dimension = bundle_dict.get(
            'dense_vector_dimension',
            manifest.get('vector_dimension', settings.RECOMMENDATION_VECTOR_DIMENSION),
        )

        self.normalization = bundle_dict.get('dense_vector_normalization', 'l2')
        self.sklearn_version = manifest.get('sklearn_version', 'unknown')
        self.artifact_hash = manifest.get('artifact_hash', '')


class _ArtifactLoaderSingleton:
    """
    Thread-safe lazy singleton for loading and caching the artifact bundle.

    Usage:
        from recommendations.services.artifact_loader import artifact_loader
        bundle = artifact_loader.get_bundle()
    """
    def __init__(self):
        self._bundle = None
        self._lock = threading.Lock()

    def get_bundle(self) -> ArtifactBundle:
        """
        Return the cached ArtifactBundle, loading it on first call.

        Raises ArtifactLoadError if loading or validation fails.
        """
        if self._bundle is not None:
            return self._bundle

        with self._lock:
            # Double-checked locking
            if self._bundle is not None:
                return self._bundle

            self._bundle = self._load()
            return self._bundle

    def reload(self) -> ArtifactBundle:
        """
        Force-reload artifacts (e.g. after deploying a new bundle).
        """
        with self._lock:
            self._bundle = self._load()
            return self._bundle

    def _load(self) -> ArtifactBundle:
        artifact_dir = Path(settings.RECOMMENDATION_ARTIFACT_DIR)

        if not artifact_dir.is_dir():
            raise ArtifactLoadError(
                f"Artifact directory does not exist: {artifact_dir}"
            )

        # Load manifest first for validation
        manifest = self._load_json(artifact_dir / 'artifact_manifest.json')

        # Validate sklearn version compatibility (if manifest provides it)
        expected_sklearn = manifest.get('sklearn_version')
        actual_sklearn = sklearn.__version__
        if expected_sklearn and expected_sklearn != actual_sklearn:
            raise ArtifactLoadError(
                f"scikit-learn version mismatch: artifact expects {expected_sklearn}, "
                f"but installed version is {actual_sklearn}. "
                f"Install scikit-learn=={expected_sklearn} to match the artifact bundle."
            )

        # Load the pickle bundle
        bundle_path = artifact_dir / 'production_transform_bundle.pkl'
        if not bundle_path.is_file():
            raise ArtifactLoadError(
                f"Transform bundle not found: {bundle_path}"
            )

        # Verify hash integrity (if manifest provides it)
        expected_hash = manifest.get('artifact_hash', '')
        if expected_hash:
            actual_hash = self._sha256(bundle_path)
            if actual_hash != expected_hash:
                raise ArtifactLoadError(
                    f"Artifact hash mismatch: expected {expected_hash[:16]}..., "
                    f"got {actual_hash[:16]}... — bundle may be corrupted or swapped."
                )

        bundle_dict = joblib.load(bundle_path)

        # Validate that the bundle is the expected dict format
        required_keys = [
            'vectorizer', 'categorical_encoder', 'multilabel_binarizers',
            'numeric_scaler', 'dense_projector',
        ]
        missing = [k for k in required_keys if k not in bundle_dict]
        if missing:
            raise ArtifactLoadError(
                f"Bundle is missing required keys: {missing}. "
                f"Available keys: {list(bundle_dict.keys())}"
            )

        logger.info(
            "Artifact bundle loaded: version=%s, dimension=%s, hash=%s",
            manifest.get('artifact_version', '?'),
            bundle_dict.get('dense_vector_dimension', '?'),
            expected_hash[:16] if expected_hash else 'none',
        )

        # Load JSON contracts
        preprocessing_contract = self._load_json(
            artifact_dir / 'preprocessing_contract.json'
        )
        feature_config = self._load_json(artifact_dir / 'feature_config.json')
        mapping_config = self._load_json(artifact_dir / 'mapping_config.json')

        bundle = ArtifactBundle(
            bundle_dict=bundle_dict,
            manifest=manifest,
            preprocessing_contract=preprocessing_contract,
            feature_config=feature_config,
            mapping_config=mapping_config,
        )

        logger.info(
            "Artifact contracts loaded: %d preprocessing fields, %d feature weights, %d destination aliases",
            len(preprocessing_contract.get('required_raw_input_fields', [])),
            len(feature_config.get('weights', {})),
            len(mapping_config.get('destination_aliases', {})),
        )

        return bundle

    @staticmethod
    def _load_json(path: Path) -> dict:
        if not path.is_file():
            raise ArtifactLoadError(f"Required artifact file not found: {path}")
        with open(path, 'r') as f:
            return json.load(f)

    @staticmethod
    def _sha256(path: Path) -> str:
        h = hashlib.sha256()
        with open(path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                h.update(chunk)
        return h.hexdigest()


# Module-level singleton — import and use everywhere
artifact_loader = _ArtifactLoaderSingleton()