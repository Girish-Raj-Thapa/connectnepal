"""
Preprocessing service — mirrors the notebook's prepare_items() logic exactly.

Converts live Django Listing instances (or traveller preference payloads)
into the canonical dict format the vectorizer pipeline expects.

Key output fields consumed by the vectorizer:
  - combined_text          (str)   → TF-IDF
  - category_mapped        (str)   → OHE
  - activity_type_for_ohe  (str)   → OHE
  - difficulty_level_norm  (str)   → OHE
  - duration_type_mapped   (str)   → OHE
  - tags_list              (list)  → MLB
  - ideal_for_list         (list)  → MLB
  - best_seasons_list      (list)  → MLB
  - languages_offered_list (list)  → MLB
  - duration_days_filled          (float) → scaler
  - duration_nights_filled        (float) → scaler
  - average_duration_hours_filled (float) → scaler
  - max_group_size                (float) → scaler

Additional fields kept for reranking:
  - destination_norm, destination_group, activity_type_mapped
"""

import json
import logging
import re

import numpy as np
import pandas as pd

from accounts.models import TravellerDetail
from listings.models import Listing
from recommendations.constants import (
    FRONTEND_ACTIVITY_SIGNAL_MAP,
    FRONTEND_TRAVEL_STYLE_SIGNAL_MAP,
)
from recommendations.services.artifact_loader import artifact_loader

logger = logging.getLogger('recommendations')


# ── Text helpers (mirror notebook exactly) ──────────────────────────────

def _clean_text(value) -> str:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return ""
    value = str(value).strip().lower()
    value = re.sub(r"\s+", " ", value)
    return value


def _split_pipe(value) -> list[str]:
    """Parse pipe-delimited strings, JSON arrays, or Python iterables."""
    if value is None:
        return []
    if isinstance(value, (float, np.floating)) and pd.isna(value):
        return []
    if isinstance(value, (list, tuple, set, np.ndarray)):
        parts = [_clean_text(part) for part in value]
        return [p for p in parts if p]
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return []
        if stripped.startswith("[") and stripped.endswith("]"):
            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, (list, tuple, set)):
                parts = [_clean_text(part) for part in parsed]
                return [p for p in parts if p]
    if pd.isna(value):
        return []
    parts = [_clean_text(part) for part in str(value).split("|")]
    return [p for p in parts if p]


def _retain_known_multivalue_labels(value, known_values: set[str]) -> list[str]:
    return [item for item in _split_pipe(value) if item in known_values]


def _dedupe_preserve_order(values) -> list[str]:
    seen = set()
    result = []
    for value in values:
        cleaned = _clean_text(value)
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        result.append(cleaned)
    return result


def _normalize_frontend_activity_preferences(activities) -> dict:
    normalized_tags = []
    description_terms = []
    category = ''
    activity_type = ''

    for raw_activity in activities or []:
        activity_key = _clean_text(raw_activity)
        if not activity_key:
            continue

        signal = FRONTEND_ACTIVITY_SIGNAL_MAP.get(activity_key)
        if signal is None:
            normalized_tags.append(activity_key)
            description_terms.append(activity_key)
            if not activity_type:
                activity_type = str(raw_activity).strip()
            continue

        normalized_tags.extend(signal.get('tags', []))
        description_terms.extend(signal.get('description', []))
        if not category and signal.get('category'):
            category = signal['category']
        if not activity_type and signal.get('activity_type'):
            activity_type = signal['activity_type']

    return {
        'tags': _dedupe_preserve_order(normalized_tags),
        'description_terms': _dedupe_preserve_order(description_terms),
        'category': category,
        'activity_type': activity_type,
    }


def _normalize_frontend_trip_style(trip_style: str | None) -> dict:
    trip_style_key = _clean_text(trip_style)
    if not trip_style_key:
        return {
            'ideal_for': [],
            'description_terms': [],
        }

    signal = FRONTEND_TRAVEL_STYLE_SIGNAL_MAP.get(trip_style_key)
    if signal is None:
        return {
            'ideal_for': [],
            'description_terms': [trip_style_key],
        }

    return {
        'ideal_for': _dedupe_preserve_order(signal.get('ideal_for', [])),
        'description_terms': _dedupe_preserve_order(signal.get('description', [])),
    }


# Normalisation helpers

def _normalize_destination(value: str, aliases: dict) -> str:
    value = _clean_text(value)
    if not value:
        return "unknown_destination"
    return aliases.get(value, value)


def _map_activity_type(raw, activity_map: dict) -> str:
    if raw is None or str(raw).strip() == "":
        return "unknown"
    raw_key = str(raw).strip().upper()
    return activity_map.get(raw_key, _clean_text(raw_key).replace(" ", "_"))


def _normalize_difficulty(value: str, expected: list, fallback_map: dict) -> str:
    value = _clean_text(value)
    if not value:
        return "easy"
    if value in expected:
        return value
    return fallback_map.get(value, "easy")


def _normalize_duration_type(value, duration_type_map: dict) -> str:
    raw = "" if value is None or (isinstance(value, float) and np.isnan(value)) else str(value).strip().upper()
    return duration_type_map.get(raw, "full_day")


def _normalize_boolean(value) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "t", "yes", "y"}


def _map_category(row: dict, mapping_contract: dict) -> str:
    """Rule-based category mapping — preserves notebook's exact rule order."""
    rule_order = mapping_contract.get('rule_order', [])
    activity_rules = mapping_contract.get('activity_to_category_rules', {})
    keyword_rules = mapping_contract.get('keyword_rules', {})
    text_fields = mapping_contract.get('text_fields_used', ['category', 'title', 'description', 'tags'])
    fallback = mapping_contract.get('fallback_category', 'cultural')

    raw_activity = str(row.get('activity_type', '')).strip().upper()
    text_blob = " ".join(_clean_text(row.get(field, '')) for field in text_fields)

    for category_name in rule_order:
        activity_match = raw_activity in activity_rules.get(category_name, [])
        keyword_match = any(kw in text_blob for kw in keyword_rules.get(category_name, []))
        if activity_match or keyword_match:
            return category_name

    return fallback


# ── Prefixed token & combined text builders ─────────────────────────────

def _build_prefixed_tokens(row: dict, recipe: dict) -> str:
    """Build the meta_token_text string using the prefixed_token_recipe."""
    tokens = []

    destination = (row.get("destination_norm") or "").replace(" ", "_")
    destination_group = (row.get("destination_group") or "").replace(" ", "_")
    category = row.get("category_mapped", "")
    difficulty = row.get("difficulty_level_norm", "")
    duration = row.get("duration_type_mapped", "")
    activity = row.get("activity_type_mapped", "")

    if destination:
        tokens.extend([f"destination_{destination}"] * recipe.get("destination_repeat", 8))
    if destination_group:
        tokens.extend([f"destinationgroup_{destination_group}"] * recipe.get("destination_group_repeat", 5))

    tokens.extend([f"category_{category}"] * recipe.get("category_repeat", 3))
    tokens.extend([f"difficulty_{difficulty}"] * recipe.get("difficulty_repeat", 2))
    tokens.extend([f"duration_{duration}"] * recipe.get("duration_repeat", 2))
    tokens.extend([f"activity_{activity}"] * recipe.get("activity_repeat", 4))

    for tag in row.get("tags_list", []):
        tokens.extend([f"tag_{tag.replace(' ', '_')}"] * recipe.get("tag_repeat", 2))
    for value in row.get("ideal_for_list", []):
        tokens.extend([f"ideal_{value.replace(' ', '_')}"] * recipe.get("ideal_repeat", 1))
    for value in row.get("best_seasons_list", []):
        tokens.extend([f"season_{value.replace(' ', '_')}"] * recipe.get("season_repeat", 1))
    for value in row.get("languages_offered_list", []):
        tokens.extend([f"lang_{value.replace(' ', '_')}"] * recipe.get("language_repeat", 1))

    return " ".join(tokens)


def _build_combined_text(row: dict) -> str:
    """Assemble combined_text exactly as the notebook does:
    title*2 + description + destination_norm*2 + destination_group*2 + meta_token_text
    """
    title = _clean_text(row.get("title", ""))
    desc = _clean_text(row.get("description", ""))
    dest = row.get("destination_norm", "") or ""
    dest_group = row.get("destination_group", "") or ""
    meta = row.get("meta_token_text", "") or ""

    parts = [title, title, desc, dest, dest, dest_group, dest_group, meta]
    combined = " ".join(parts)
    return re.sub(r"\s+", " ", combined).strip()


# ── Duration fill logic ─────────────────────────────────────────────────

def _fill_duration_fields(row: dict) -> dict:
    """Fill duration_days_filled, duration_nights_filled, average_duration_hours_filled
    using the same logic as the notebook's prepare_items()."""
    duration_type = row.get("duration_type_mapped", "full_day")
    duration_days = row.get("duration_days")
    duration_nights = row.get("duration_nights")
    avg_hours = row.get("average_duration_hours")

    # Convert to float, treating None/NaN as missing
    def to_float_or_none(v):
        if v is None:
            return None
        try:
            f = float(v)
            return None if np.isnan(f) else f
        except (TypeError, ValueError):
            return None

    days_val = to_float_or_none(duration_days)
    nights_val = to_float_or_none(duration_nights)
    hours_val = to_float_or_none(avg_hours)

    # Default days based on duration_type
    if days_val is None:
        if duration_type == "half_day":
            days_val = 0.5
        elif duration_type == "multi_day":
            days_val = 2.0
        else:
            days_val = 1.0

    # Default nights
    if nights_val is None:
        if duration_type == "multi_day":
            nights_val = max(days_val - 1, 1)
        else:
            nights_val = 0.0

    # Default average hours
    if hours_val is None:
        if duration_type == "half_day":
            hours_val = 4.0
        elif duration_type == "full_day":
            hours_val = 7.0
        else:
            hours_val = days_val * 8.0

    row["duration_days_filled"] = days_val
    row["duration_nights_filled"] = nights_val
    row["average_duration_hours_filled"] = hours_val
    return row


# Public API

def preprocess_listing(listing: Listing) -> dict:
    """
    Convert a live Listing instance into the canonical dict format
    expected by the vectorizer pipeline.

    Returns a dict with all fields needed for vectorization + reranking.
    """
    bundle = artifact_loader.get_bundle()
    raw = _extract_listing_fields(listing)
    return _apply_canonical_preprocessing(raw, bundle)


def preprocess_listing_batch(listings) -> list[dict]:
    """
    Preprocess a batch of Listing instances.
    Loads the artifact bundle once and applies preprocessing to each.
    """
    bundle = artifact_loader.get_bundle()
    results = []
    for listing in listings:
        raw = _extract_listing_fields(listing)
        results.append(_apply_canonical_preprocessing(raw, bundle))
    return results


def preprocess_traveller_query(user) -> dict:
    """
    Build a synthetic query payload from a traveller's onboarding preferences.

    Creates a dict in the same canonical format as a preprocessed listing,
    with values derived from TravellerDetail preferences. Fields the traveller
    hasn't set get contract defaults.
    """
    bundle = artifact_loader.get_bundle()

    try:
        prefs = user.traveller_detail
    except TravellerDetail.DoesNotExist:
        prefs = None

    raw = _build_preference_payload(prefs, user)

    # Trip-style onboarding values are much cleaner than the exported
    # ideal_for artifact vocabulary. Drop unsupported ideal_for labels at the
    # query source so we do not inject guaranteed-unknown classes.
    raw['ideal_for'] = _retain_known_multivalue_labels(
        raw.get('ideal_for', []),
        known_values=set(bundle.multilabel_binarizers['ideal_for_list'].classes_),
    )
    return _apply_canonical_preprocessing(raw, bundle)


# Internal helpers

def _extract_listing_fields(listing: Listing) -> dict:
    """
    Extract all recommendation-relevant fields from a Listing model instance.

    Field names match the notebook's required_raw_input_fields.
    Note: Listing model uses 'instant_booking' but artifact expects 'instant_confirmation'.
    Note: Listing model has no 'duration_text' field — we pass empty string.
    """
    return {
        'title': listing.title or '',
        'description': listing.description or '',
        'destination': listing.destination or '',
        'category': listing.category or '',
        'activity_type': listing.activity_type or '',
        'difficulty_level': listing.difficulty_level or '',
        'duration_type': listing.duration_type or '',
        'duration_days': listing.duration_days,
        'duration_nights': listing.duration_nights,
        'average_duration_hours': float(listing.average_duration_hours or 0),
        'duration_text': '',
        'tags': listing.tags or [],
        'ideal_for': listing.ideal_for or [],
        'best_seasons': listing.best_seasons or [],
        'languages_offered': listing.languages_offered or [],
        'max_group_size': listing.max_group_size or 0,
        'instant_confirmation': _normalize_boolean(listing.instant_booking),
        'is_bookable': _normalize_boolean(listing.is_bookable),
        'is_active': _normalize_boolean(listing.is_active),
    }


def _build_preference_payload(prefs, user) -> dict:
    """
    Build a synthetic listing-like raw payload from traveller preferences.

    The "for you" recommendations find listings whose vectors are close to
    the traveller's preference vector. So we build a synthetic "ideal listing"
    dict from their preferences.
    """
    payload = {
        'title': '',
        'description': '',
        'destination': '',
        'category': '',
        'activity_type': '',
        'difficulty_level': '',
        'duration_type': '',
        'duration_days': None,
        'duration_nights': None,
        'average_duration_hours': None,
        'duration_text': '',
        'tags': [],
        'ideal_for': [],
        'best_seasons': [],
        'languages_offered': [],
        'max_group_size': 0,
        'instant_confirmation': False,
        'is_bookable': True,
        'is_active': True,
    }

    if prefs:
        activities = prefs.preferred_activities or []
        activity_signals = _normalize_frontend_activity_preferences(activities)
        payload['tags'] = activity_signals['tags']
        if activity_signals['activity_type']:
            payload['activity_type'] = activity_signals['activity_type']
        if activity_signals['category']:
            payload['category'] = activity_signals['category']

        trip_style_signals = _normalize_frontend_trip_style(
            prefs.preferred_trip_style
        )
        payload['ideal_for'] = trip_style_signals['ideal_for']

        # Build a description from preferences to influence TF-IDF
        desc_parts = []
        if activity_signals['description_terms']:
            desc_parts.append(' '.join(activity_signals['description_terms']))
        elif activities:
            desc_parts.append(' '.join(_clean_text(a) for a in activities if a))
        if trip_style_signals['description_terms']:
            desc_parts.append(' '.join(trip_style_signals['description_terms']))
        elif prefs.preferred_trip_style:
            desc_parts.append(_clean_text(prefs.preferred_trip_style))
        payload['description'] = ' '.join(desc_parts)

    # User location as destination hint
    if hasattr(user, 'city') and user.city:
        payload['destination'] = user.city

    return payload


def _apply_canonical_preprocessing(raw: dict, bundle) -> dict:
    """
    Apply the full canonical preprocessing pipeline from the notebook's
    prepare_items() to a single raw dict.

    Returns a dict with all fields the vectorizer expects.
    """
    mapping = bundle.mapping_config
    contract = bundle.preprocessing_contract
    feature_cfg = bundle.feature_config

    aliases = mapping.get('destination_aliases', {})
    group_map = mapping.get('destination_group_map', {})
    activity_map = mapping.get('activity_map', {})
    difficulty_fallback = mapping.get('difficulty_fallback_map', {})
    duration_type_map = mapping.get('duration_type_map', {})
    category_contract = mapping.get('category_mapping_contract', {})
    recipe = feature_cfg.get('prefixed_token_recipe', {})
    expected_difficulty = contract.get('expected_difficulty_values',
                                       ['easy', 'moderate', 'challenging', 'difficult', 'expert'])

    row = {}

    # --- Text fields ---
    row['title'] = str(raw.get('title', '') or '')
    row['description'] = str(raw.get('description', '') or '')
    row['destination'] = str(raw.get('destination', '') or '')
    row['category'] = str(raw.get('category', '') or '')
    row['activity_type'] = str(raw.get('activity_type', '') or '')
    row['difficulty_level'] = str(raw.get('difficulty_level', '') or '')
    row['duration_type'] = str(raw.get('duration_type', '') or '')
    row['duration_text'] = str(raw.get('duration_text', '') or '')

    # --- Multi-value fields ---
    row['tags'] = raw.get('tags', '') or ''
    row['tags_list'] = _split_pipe(raw.get('tags', []))
    row['ideal_for'] = raw.get('ideal_for', '') or ''
    row['ideal_for_list'] = _split_pipe(raw.get('ideal_for', []))
    row['best_seasons'] = raw.get('best_seasons', '') or ''
    row['best_seasons_list'] = _split_pipe(raw.get('best_seasons', []))
    row['languages_offered'] = raw.get('languages_offered', '') or ''
    row['languages_offered_list'] = _split_pipe(raw.get('languages_offered', []))

    # --- Numeric fields ---
    row['duration_days'] = raw.get('duration_days')
    row['duration_nights'] = raw.get('duration_nights')
    row['average_duration_hours'] = raw.get('average_duration_hours')
    row['max_group_size'] = float(raw.get('max_group_size', 0) or 0)

    # --- Boolean fields (non-semantic, kept for metadata) ---
    row['instant_confirmation'] = _normalize_boolean(raw.get('instant_confirmation', False))
    row['is_bookable'] = _normalize_boolean(raw.get('is_bookable', False))
    row['is_active'] = _normalize_boolean(raw.get('is_active', True))

    # --- Derived fields ---
    row['destination_norm'] = _normalize_destination(row['destination'], aliases)
    row['destination_group'] = group_map.get(
        row['destination_norm'],
        row['destination_norm'] if row['destination_norm'] else 'unknown_destination',
    )

    row['category_mapped'] = _map_category(raw, category_contract)
    row['activity_type_mapped'] = _map_activity_type(row['activity_type'], activity_map)
    row['activity_type_for_ohe'] = row['activity_type_mapped'] or 'unknown'
    row['difficulty_level_norm'] = _normalize_difficulty(
        row['difficulty_level'], expected_difficulty, difficulty_fallback,
    )
    row['duration_type_mapped'] = _normalize_duration_type(row['duration_type'], duration_type_map)

    # --- Duration fill ---
    _fill_duration_fields(row)

    # --- Token text ---
    row['meta_token_text'] = _build_prefixed_tokens(row, recipe)
    row['combined_text'] = _build_combined_text(row)

    return row
