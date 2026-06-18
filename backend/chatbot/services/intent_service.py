import json
import logging
import re

from chatbot.services.ollama_service import generate_response

logger = logging.getLogger('chatbot')


VALID_ROUTE_NAMES = {
    'faq_help',
    'listing_explain',
    'package_explain',
    'general_suggestion',
    'booking_info',
    'personalized_recommendation',
    'fallback',
}

GREETING_PATTERNS = [
    r'^(hi+|hello+|hey+|heya+|hiya|ola+|hola+|namaste|good morning|good afternoon|good evening)(\s+(there|again|bot|chatbot|connectnepal))?[\s!.?]*$',
]

BOOKING_DATA_PATTERNS = [
    r'\b(show|list|see|check|view|summari[sz]e|tell me)\b.*\b(my|our)\b.*\b(bookings?|trips?|reservations?)\b',
    r'\b(my|our)\b.*\b(upcoming|current|next)\b.*\b(bookings?|trips?|reservations?)\b',
    r'\bdo i have any\b.*\b(bookings?|trips?|reservations?)\b',
    r'\bwhat\b.*\b(bookings?|trips?|reservations?)\b.*\bdo i have\b',
]

PERSONALIZED_REQUEST_PATTERNS = [
    r'\b(give|show|recommend|suggest|find)\b.*\b(personali[sz]ed|for me|my preferences|my taste)\b',
    r'\b(personali[sz]ed)\b.*\b(recommendations?|suggestions?)\b',
    r'\bwhat\b.*\b(suits?|matches?)\b.*\bme\b',
]

FAQ_LIKELY_PATTERNS = [
    r'\b(how do i|how can i|how to|can i|do you|does connectnepal|what payment|payment method|refund|cancell|policy|guest|without logging in|before logging in|account|login|log in|sign up|register|password|support|contact|booking|bookings|review|trip plan|recommendations?)\b',
]

LISTING_QUESTION_PATTERNS = [
    r'\b(this|the)\s+(listing|experience|activity)\b',
    r'\b(amenities|included|include|inclusions|exclusions)\b.*\b(listing|experience|activity)\b',
    r'\b(tell me about|explain|describe)\b.*\b(listing|experience|activity)\b',
    r'\b(cancellation policy|requirements|difficulty|duration)\b.*\b(listing|experience|activity)\b',
]

LISTING_CONTEXTUAL_PATTERNS = [
    r'\b(tell me more|more about this|explain this)\b',
    r'\b(what is|what\'s|what does)\b.*\b(included|include)\b',
    r'\b(how long is it|how difficult is it|what should i bring|what are the requirements)\b',
    r'\b(is it suitable for beginners|is it family friendly|is this available|when is it available)\b',
    r'\b(what is the cancellation policy|how much does it cost)\b',
]

PACKAGE_QUESTION_PATTERNS = [
    r'\b(this|the)\s+package\b',
    r'\b(package details?|package info)\b',
    r'\b(what is|what\'s|what does)\b.*\binclude\b.*\bpackage\b',
    r'\b(itinerary|highlights|terms|validity)\b.*\bpackage\b',
    r'\b(cancellation policy|breakfast included|included|inclusions|exclusions)\b.*\bpackage\b',
]

PACKAGE_CONTEXTUAL_PATTERNS = [
    r'\b(tell me more|more about this|explain this)\b',
    r'\b(what is|what\'s|what does)\b.*\b(included|include)\b',
    r'\b(is breakfast included|what is the itinerary|what are the highlights)\b',
    r'\b(what are the terms|what is the validity|is this available|when is it available)\b',
    r'\b(what is the cancellation policy|how much does it cost|how long is it)\b',
]

GENERAL_SUGGESTION_PATTERNS = [
    r'\b(suggest|recommend)\b.*\b(places|destinations|trips|activities|listings|packages)\b',
    r'\b(places to visit|things to do|what to do|where should i go)\b',
    r'\b(weekend trip|family destination|mountain destination|quiet trip|good in april)\b',
    r'\b(explore|visit)\b.*\b(nepal|pokhara|kathmandu|chitwan|mustang|annapurna|everest)\b',
]


def _matches_any(message: str, patterns: list[str]) -> bool:
    return any(re.search(pattern, message) for pattern in patterns)


def normalize_message(user_message: str) -> str:
    return user_message.lower().strip()


def is_greeting_only(user_message: str) -> bool:
    return _matches_any(normalize_message(user_message), GREETING_PATTERNS)


def is_booking_data_request(user_message: str) -> bool:
    message = normalize_message(user_message)
    if re.search(r'\b(how can i|how do i|can i check|where can i find)\b', message):
        return False
    return _matches_any(message, BOOKING_DATA_PATTERNS)


def is_personalized_request(user_message: str) -> bool:
    message = normalize_message(user_message)
    if re.search(r'^(can|do|does|are|is)\b', message):
        return False
    return _matches_any(message, PERSONALIZED_REQUEST_PATTERNS)


def is_faq_likely(user_message: str) -> bool:
    message = normalize_message(user_message)
    return _matches_any(message, FAQ_LIKELY_PATTERNS)


def is_listing_question(user_message: str, has_active_context: bool = False) -> bool:
    message = normalize_message(user_message)
    patterns = list(LISTING_QUESTION_PATTERNS)
    if has_active_context:
        patterns.extend(LISTING_CONTEXTUAL_PATTERNS)
    return _matches_any(message, patterns)


def is_package_question(user_message: str, has_active_context: bool = False) -> bool:
    message = normalize_message(user_message)
    patterns = list(PACKAGE_QUESTION_PATTERNS)
    if has_active_context:
        patterns.extend(PACKAGE_CONTEXTUAL_PATTERNS)
    return _matches_any(message, patterns)


def is_general_suggestion_request(user_message: str) -> bool:
    message = normalize_message(user_message)
    if is_personalized_request(message):
        return False
    return _matches_any(message, GENERAL_SUGGESTION_PATTERNS)


def build_rule_based_candidates(
    user_message: str,
    *,
    listing_id: int | None = None,
    package_id: int | None = None,
    is_authenticated: bool = False,
) -> list[dict]:
    """
    Return deterministic route candidates before any LLM tie-break.
    """
    message = normalize_message(user_message)
    candidates: list[dict] = []

    if is_greeting_only(message):
        candidates.append({
            'name': 'fallback',
            'score': 0.95,
            'source': 'rule',
            'reason': 'Greeting-only message.',
        })
        return candidates

    if is_booking_data_request(message):
        candidates.append({
            'name': 'booking_info',
            'score': 0.95 if is_authenticated else 0.9,
            'source': 'rule',
            'reason': 'Explicit request for the user\'s own booking data.',
        })

    if is_personalized_request(message):
        candidates.append({
            'name': 'personalized_recommendation',
            'score': 0.92 if is_authenticated else 0.88,
            'source': 'rule',
            'reason': 'Explicit request for personalised suggestions.',
        })

    if is_faq_likely(message):
        candidates.append({
            'name': 'faq_help',
            'score': 0.85,
            'source': 'rule',
            'reason': 'Platform help, policy, or capability question.',
        })

    if is_package_question(message, has_active_context=bool(package_id)):
        candidates.append({
            'name': 'package_explain',
            'score': 0.82 if package_id else 0.72,
            'source': 'rule',
            'reason': 'Package-specific wording with optional active package context.',
        })

    if is_listing_question(message, has_active_context=bool(listing_id)):
        candidates.append({
            'name': 'listing_explain',
            'score': 0.82 if listing_id else 0.72,
            'source': 'rule',
            'reason': 'Listing-specific wording with optional active listing context.',
        })

    if is_general_suggestion_request(message):
        candidates.append({
            'name': 'general_suggestion',
            'score': 0.7,
            'source': 'rule',
            'reason': 'Open-ended travel suggestions request.',
        })

    return candidates


def score_capabilities_with_ollama(user_message: str, is_authenticated: bool) -> list[dict]:
    """
    Use Ollama as a tie-breaker by returning scored route candidates in JSON.
    """
    auth_routes = ""
    if is_authenticated:
        auth_routes = """
- booking_info: requests for the user's own bookings, trips, or reservation status.
- personalized_recommendation: requests for tailored suggestions for the current user.
"""

    prompt = f"""You are a route scorer for a Nepal travel booking platform chatbot.

Score the user message against these routes:
- faq_help: platform rules, policies, feature availability, guest/log-in questions, how-to questions.
- listing_explain: questions about a specific listing or activity being viewed.
- package_explain: questions about a specific package being viewed.
- general_suggestion: broad travel ideas or destination suggestions not tied to a specific user.
{auth_routes}- fallback: greetings, unclear requests, or unsupported off-topic messages.

Return ONLY valid JSON in this shape:
{{"candidates":[{{"name":"faq_help","score":0.0,"reason":"..."}}]}}

Rules:
- Use scores between 0 and 1.
- Include at most 3 candidates.
- Do not include any route name outside the allowed list.
- Prefer faq_help for platform capability/policy questions.
- Prefer booking_info only for the user's own booking data.
- Prefer personalized_recommendation only for tailored suggestions for the current user.

User message: "{user_message}"
"""

    try:
        response_text = generate_response(prompt)
        payload = json.loads(response_text)
    except Exception as exc:
        logger.warning("Ollama capability scoring failed: %s", str(exc))
        return []

    raw_candidates = payload.get('candidates', [])
    candidates: list[dict] = []
    for candidate in raw_candidates:
        name = candidate.get('name')
        score = candidate.get('score')
        if name not in VALID_ROUTE_NAMES:
            continue
        try:
            numeric_score = float(score)
        except (TypeError, ValueError):
            continue

        candidates.append({
            'name': name,
            'score': max(0.0, min(1.0, numeric_score)),
            'source': 'ollama',
            'reason': candidate.get('reason', 'LLM tie-break suggestion.'),
        })

    return sorted(candidates, key=lambda item: item['score'], reverse=True)


def detect_intent(
    user_message: str,
    listing_id: int | None = None,
    package_id: int | None = None,
    is_authenticated: bool = False,
) -> str:
    """
    Backward-compatible single-label guess used by legacy callers.

    The chatbot runtime now uses router_service instead of relying on this
    function for final routing decisions.
    """
    candidates = build_rule_based_candidates(
        user_message,
        listing_id=listing_id,
        package_id=package_id,
        is_authenticated=is_authenticated,
    )
    if not candidates:
        candidates = score_capabilities_with_ollama(user_message, is_authenticated)

    if not candidates:
        return 'fallback'

    best = max(candidates, key=lambda item: item['score'])
    intent = best['name']

    if not is_authenticated and intent in {'booking_info', 'personalized_recommendation'}:
        return 'fallback'

    return intent
