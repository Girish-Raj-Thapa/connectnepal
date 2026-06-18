from dataclasses import dataclass, field

from django.conf import settings

from chatbot.services.intent_service import (
    build_rule_based_candidates,
    is_booking_data_request,
    is_faq_likely,
    is_general_suggestion_request,
    is_greeting_only,
    is_listing_question,
    is_package_question,
    is_personalized_request,
    score_capabilities_with_ollama,
)
from chatbot.services.rag_service import get_faq_fallback_response, retrieve_faq_candidates
from chatbot.services.tool_service import fetch_listing, fetch_package

BOOKINGS_LOGIN_REQUIRED_REPLY = (
    "I can show your upcoming bookings after you log in to your traveller account."
)

GUEST_GREETING_REPLY = (
    "Hello there! I'm here to help with ConnectNepal. "
    "Ask about bookings, listings, packages, or travel suggestions in Nepal."
)

ENTITY_CONTEXT_REQUIRED_REPLY = (
    "I can explain a specific listing or package when you're viewing it. "
    "Open a listing or package and ask again, or ask for general travel suggestions."
)

PERSONALIZED_DOWNGRADE_NOTE = (
    "The user asked for personalized recommendations. Start by briefly saying that "
    "personalized recommendations require login, then offer general suggestions "
    "using only the available listing data below."
)


@dataclass
class RouteCandidate:
    name: str
    score: float
    source: str
    reason: str


@dataclass
class RoutingEvidence:
    faq_results: list[dict] = field(default_factory=list)
    faq_top_distance: float | None = None
    faq_checked: bool = False
    listing_data: dict | None = None
    package_data: dict | None = None
    is_authenticated: bool = False


@dataclass
class RouteDecision:
    selected_route: str
    candidates: list[RouteCandidate]
    evidence: RoutingEvidence
    downgrade_from: str | None = None
    downgrade_reason: str = ""
    fixed_reply: str | None = None
    prompt_note: str = ""


def route_message(
    *,
    message: str,
    user=None,
    listing_id: int | None = None,
    package_id: int | None = None,
) -> RouteDecision:
    """
    Route a message to the safest supported chatbot capability.
    """
    is_authenticated = user is not None and user.is_authenticated
    evidence = RoutingEvidence(is_authenticated=is_authenticated)
    rule_candidates = [
        RouteCandidate(**candidate)
        for candidate in build_rule_based_candidates(
            message,
            listing_id=listing_id,
            package_id=package_id,
            is_authenticated=is_authenticated,
        )
    ]

    if is_booking_data_request(message):
        booking_candidate = _first_candidate(rule_candidates, 'booking_info')
        if is_authenticated:
            return RouteDecision(
                selected_route='booking_info',
                candidates=[booking_candidate] if booking_candidate else [],
                evidence=evidence,
            )
        return RouteDecision(
            selected_route='booking_info',
            candidates=[booking_candidate] if booking_candidate else [],
            evidence=evidence,
            fixed_reply=BOOKINGS_LOGIN_REQUIRED_REPLY,
            downgrade_reason='authentication_required',
        )

    if is_personalized_request(message):
        personalized_candidate = _first_candidate(
            rule_candidates,
            'personalized_recommendation',
        )
        if is_authenticated:
            return RouteDecision(
                selected_route='personalized_recommendation',
                candidates=[personalized_candidate] if personalized_candidate else [],
                evidence=evidence,
            )
        return RouteDecision(
            selected_route='general_suggestion',
            candidates=[
                candidate
                for candidate in [
                    personalized_candidate,
                    RouteCandidate(
                        name='general_suggestion',
                        score=0.68,
                        source='guard',
                        reason='Guest downgrade from personalized recommendations.',
                    ),
                ]
                if candidate is not None
            ],
            evidence=evidence,
            downgrade_from='personalized_recommendation',
            downgrade_reason='authentication_required',
            prompt_note=PERSONALIZED_DOWNGRADE_NOTE,
        )

    if is_greeting_only(message):
        fallback_candidate = _first_candidate(rule_candidates, 'fallback')
        return RouteDecision(
            selected_route='fallback',
            candidates=[fallback_candidate] if fallback_candidate else [],
            evidence=evidence,
            fixed_reply=_build_greeting_reply(user),
        )

    if is_package_question(message) and not package_id:
        package_candidate = _first_candidate(rule_candidates, 'package_explain')
        return RouteDecision(
            selected_route='package_explain',
            candidates=[package_candidate] if package_candidate else [],
            evidence=evidence,
            fixed_reply=ENTITY_CONTEXT_REQUIRED_REPLY,
            downgrade_reason='package_context_required',
        )

    if is_listing_question(message) and not listing_id:
        listing_candidate = _first_candidate(rule_candidates, 'listing_explain')
        return RouteDecision(
            selected_route='listing_explain',
            candidates=[listing_candidate] if listing_candidate else [],
            evidence=evidence,
            fixed_reply=ENTITY_CONTEXT_REQUIRED_REPLY,
            downgrade_reason='listing_context_required',
        )

    if _has_entity_context_request(message, listing_id=listing_id, package_id=package_id):
        entity_decision = _route_entity_request(
            message=message,
            evidence=evidence,
            rule_candidates=rule_candidates,
            listing_id=listing_id,
            package_id=package_id,
        )
        if entity_decision is not None:
            return entity_decision

    faq_likely = is_faq_likely(message)
    if faq_likely:
        _ensure_faq_evidence(message, evidence)

    if faq_likely:
        faq_candidate = _first_candidate(rule_candidates, 'faq_help') or RouteCandidate(
            name='faq_help',
            score=0.85,
            source='rule',
            reason='Platform help or policy question.',
        )
        if _has_strong_faq_match(evidence):
            return RouteDecision(
                selected_route='faq_help',
                candidates=[faq_candidate],
                evidence=evidence,
                fixed_reply=_get_direct_faq_reply(evidence),
            )
        return RouteDecision(
            selected_route='faq_help',
            candidates=[faq_candidate],
            evidence=evidence,
            fixed_reply=get_faq_fallback_response(),
            downgrade_reason='faq_match_missing_or_weak',
        )

    if is_general_suggestion_request(message):
        return RouteDecision(
            selected_route='general_suggestion',
            candidates=[
                _first_candidate(rule_candidates, 'general_suggestion') or RouteCandidate(
                    name='general_suggestion',
                    score=0.7,
                    source='rule',
                    reason='Open-ended travel suggestion request.',
                ),
            ],
            evidence=evidence,
        )

    llm_candidates = [
        RouteCandidate(**candidate)
        for candidate in score_capabilities_with_ollama(message, is_authenticated)
    ]

    validated = _validate_candidate_routes(
        candidates=llm_candidates,
        message=message,
        evidence=evidence,
        listing_id=listing_id,
        package_id=package_id,
    )
    if validated is not None:
        return validated

    return RouteDecision(
        selected_route='fallback',
        candidates=rule_candidates[:1],
        evidence=evidence,
    )


def _first_candidate(candidates: list[RouteCandidate], route_name: str) -> RouteCandidate | None:
    for candidate in candidates:
        if candidate.name == route_name:
            return candidate
    return None


def _has_entity_context_request(
    message: str,
    *,
    listing_id: int | None,
    package_id: int | None,
) -> bool:
    if package_id and is_package_question(message, has_active_context=True):
        return True
    if listing_id and is_listing_question(message, has_active_context=True):
        return True
    return False


def _route_entity_request(
    *,
    message: str,
    evidence: RoutingEvidence,
    rule_candidates: list[RouteCandidate],
    listing_id: int | None,
    package_id: int | None,
) -> RouteDecision | None:
    package_candidate = _first_candidate(rule_candidates, 'package_explain')
    listing_candidate = _first_candidate(rule_candidates, 'listing_explain')

    if package_id or is_package_question(message, has_active_context=bool(package_id)):
        if evidence.package_data is None and package_id:
            evidence.package_data = fetch_package(package_id)
        if evidence.package_data:
            return RouteDecision(
                selected_route='package_explain',
                candidates=[package_candidate] if package_candidate else [],
                evidence=evidence,
            )
        if is_package_question(message, has_active_context=bool(package_id)):
            return RouteDecision(
                selected_route='package_explain',
                candidates=[package_candidate] if package_candidate else [],
                evidence=evidence,
                fixed_reply=ENTITY_CONTEXT_REQUIRED_REPLY,
                downgrade_reason='package_context_required',
            )

    if listing_id or is_listing_question(message, has_active_context=bool(listing_id)):
        if evidence.listing_data is None and listing_id:
            evidence.listing_data = fetch_listing(listing_id)
        if evidence.listing_data:
            return RouteDecision(
                selected_route='listing_explain',
                candidates=[listing_candidate] if listing_candidate else [],
                evidence=evidence,
            )
        if is_listing_question(message, has_active_context=bool(listing_id)):
            return RouteDecision(
                selected_route='listing_explain',
                candidates=[listing_candidate] if listing_candidate else [],
                evidence=evidence,
                fixed_reply=ENTITY_CONTEXT_REQUIRED_REPLY,
                downgrade_reason='listing_context_required',
            )

    return None


def _validate_candidate_routes(
    *,
    candidates: list[RouteCandidate],
    message: str,
    evidence: RoutingEvidence,
    listing_id: int | None,
    package_id: int | None,
) -> RouteDecision | None:
    for candidate in candidates:
        if candidate.name == 'faq_help':
            _ensure_faq_evidence(message, evidence)
            if _has_strong_faq_match(evidence):
                return RouteDecision(
                    selected_route='faq_help',
                    candidates=[candidate],
                    evidence=evidence,
                    fixed_reply=_get_direct_faq_reply(evidence),
                )
            continue

        if candidate.name == 'package_explain':
            if evidence.package_data is None and package_id:
                evidence.package_data = fetch_package(package_id)
            if evidence.package_data:
                return RouteDecision(
                    selected_route='package_explain',
                    candidates=[candidate],
                    evidence=evidence,
                )
            continue

        if candidate.name == 'listing_explain':
            if evidence.listing_data is None and listing_id:
                evidence.listing_data = fetch_listing(listing_id)
            if evidence.listing_data:
                return RouteDecision(
                    selected_route='listing_explain',
                    candidates=[candidate],
                    evidence=evidence,
                )
            continue

        if candidate.name == 'general_suggestion':
            return RouteDecision(
                selected_route='general_suggestion',
                candidates=[candidate],
                evidence=evidence,
            )

        if candidate.name == 'fallback':
            return RouteDecision(
                selected_route='fallback',
                candidates=[candidate],
                evidence=evidence,
            )

    return None


def _ensure_faq_evidence(message: str, evidence: RoutingEvidence) -> None:
    if evidence.faq_checked:
        return

    faq_candidates = retrieve_faq_candidates(message, threshold=None)
    evidence.faq_top_distance = faq_candidates[0]['distance'] if faq_candidates else None
    evidence.faq_results = [
        item
        for item in faq_candidates
        if item['distance'] <= settings.CHATBOT_FAQ_SIMILARITY_THRESHOLD
    ]
    evidence.faq_checked = True


def _has_strong_faq_match(evidence: RoutingEvidence) -> bool:
    return (
        evidence.faq_top_distance is not None
        and evidence.faq_top_distance <= settings.CHATBOT_FAQ_STRONG_MATCH_THRESHOLD
    )


def _get_direct_faq_reply(evidence: RoutingEvidence) -> str | None:
    if not evidence.faq_results:
        return None
    return evidence.faq_results[0]['answer']


def _build_greeting_reply(user) -> str:
    if user is None or not getattr(user, 'is_authenticated', False):
        return GUEST_GREETING_REPLY

    name = _get_greeting_name(user)
    if not name:
        return GUEST_GREETING_REPLY

    return (
        f"Hi {name}! I'm here to help with ConnectNepal. "
        "Ask about your bookings, listings, packages, trip plans, or travel suggestions in Nepal."
    )


def _get_greeting_name(user) -> str:
    first_name = getattr(user, 'first_name', '') or ''
    first_name = first_name.strip()
    if first_name:
        return first_name.split()[0].title()

    full_name = getattr(user, 'full_name', '') or ''
    full_name = full_name.strip()
    if full_name and '@' not in full_name:
        return full_name.split()[0].title()

    return ""
