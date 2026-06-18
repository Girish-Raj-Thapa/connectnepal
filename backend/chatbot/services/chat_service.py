import logging
from dataclasses import asdict

from django.conf import settings
from django.db import transaction

from chatbot.models import ChatMessage, ChatSession
from chatbot.services.ollama_service import generate_response
from chatbot.services.prompt_service import (
    build_booking_prompt,
    build_fallback_prompt,
    build_faq_prompt,
    build_general_suggestion_prompt,
    build_listing_prompt,
    build_package_prompt,
    build_recommendation_prompt,
)
from chatbot.services.router_service import RouteDecision, RoutingEvidence, route_message
from chatbot.services.tool_service import (
    get_recommendations,
    get_upcoming_bookings,
    search_listings,
)
from utils.exceptions import ServiceError

logger = logging.getLogger('chatbot')

CHATBOT_ERROR_REPLY = (
    "I'm sorry, I'm having trouble answering right now. "
    "Please try again in a moment."
)


def handle_chat_message(
    message: str,
    user=None,
    session_id: int | None = None,
    guest_session_id: str | None = None,
    listing_id: int | None = None,
    package_id: int | None = None,
) -> dict:
    """
    Main orchestrator for processing a chat message.

    Args:
        message: The user's message text.
        user: Authenticated user (Account instance) or None for guests.
        session_id: Existing session ID to continue, or None for new session.
        guest_session_id: UUID string for guest session tracking.
        listing_id: Optional listing ID if user is on a listing page.
        package_id: Optional package ID if user is on a package page.

    Returns:
        Dict with keys: reply, session_id, intent.
    """
    with transaction.atomic():
        session = _get_or_create_session(
            user=user,
            session_id=session_id,
            guest_session_id=guest_session_id,
        )

        ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.USER,
            content=message,
        )

    fallback_decision = RouteDecision(
        selected_route='fallback',
        candidates=[],
        evidence=RoutingEvidence(
            is_authenticated=bool(user and getattr(user, "is_authenticated", False))
        ),
        downgrade_reason='internal_error',
    )
    decision = fallback_decision
    intent = decision.selected_route
    context_data = None
    reply = CHATBOT_ERROR_REPLY
    metadata_error = None

    try:
        conversation_history = _load_conversation_history(session)
        decision = route_message(
            message=message,
            user=user,
            listing_id=listing_id,
            package_id=package_id,
        )
        intent = decision.selected_route
        context_data = _gather_context(
            decision=decision,
            message=message,
            user=user,
        )

        if decision.fixed_reply:
            reply = decision.fixed_reply
        else:
            prompt = _build_prompt(
                decision=decision,
                message=message,
                context_data=context_data,
                conversation_history=conversation_history,
            )
            reply = generate_response(prompt)
    except Exception:
        logger.exception("Chat processing failed for session %s", session.pk)
        decision = fallback_decision
        intent = decision.selected_route
        context_data = None
        reply = CHATBOT_ERROR_REPLY
        metadata_error = "internal_error"

    metadata = {
        'intent': intent,
        'selected_route': decision.selected_route,
        'route_candidates': [
            asdict(candidate)
            for candidate in decision.candidates
        ],
        'downgrade_from': decision.downgrade_from,
        'downgrade_reason': decision.downgrade_reason,
        'evidence': {
            'is_authenticated': decision.evidence.is_authenticated,
            'faq_top_distance': decision.evidence.faq_top_distance,
            'faq_result_count': len(decision.evidence.faq_results),
            'has_listing_context': decision.evidence.listing_data is not None,
            'has_package_context': decision.evidence.package_data is not None,
        },
    }
    if metadata_error:
        metadata['error'] = metadata_error
    if intent == 'faq_help' and context_data:
        metadata['faq_sources'] = [
            {'question': item['question'], 'distance': item['distance']}
            for item in context_data
        ]

    with transaction.atomic():
        ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.ASSISTANT,
            content=reply,
            intent=intent,
            metadata=metadata,
        )

        if not session.title:
            session.title = message[:255]
            session.save(update_fields=['title', 'updated_at'])

    return {
        'reply': reply,
        'session_id': session.pk,
        'intent': intent,
    }


def _get_or_create_session(user, session_id, guest_session_id):
    """
    Load an existing session or create a new one.
    """
    if session_id:
        try:
            session = ChatSession.objects.get(pk=session_id, is_active=True)

            if user and user.is_authenticated:
                if session.user and session.user != user:
                    raise ServiceError(
                        detail="You do not have access to this chat session.",
                        status_code=403,
                    )
                if not session.user:
                    session.user = user
                    session.save(update_fields=['user', 'updated_at'])
            else:
                if session.user:
                    raise ServiceError(
                        detail="You do not have access to this chat session.",
                        status_code=403,
                    )
                if not session.guest_session_id:
                    raise ServiceError(
                        detail="Anonymous chat sessions cannot be resumed. Please start a new chat session.",
                        status_code=403,
                    )
                if not guest_session_id or str(session.guest_session_id) != str(guest_session_id):
                    raise ServiceError(
                        detail="You do not have access to this chat session.",
                        status_code=403,
                    )

            return session
        except ChatSession.DoesNotExist:
            pass

    return ChatSession.objects.create(
        user=user if user and user.is_authenticated else None,
        guest_session_id=guest_session_id,
    )


def _gather_context(decision: RouteDecision, message: str, user):
    """
    Fetch the appropriate context data based on the selected route.
    """
    intent = decision.selected_route

    if intent == 'faq_help':
        return decision.evidence.faq_results

    if intent == 'listing_explain':
        return decision.evidence.listing_data

    if intent == 'package_explain':
        return decision.evidence.package_data

    if intent == 'general_suggestion':
        filters = _extract_search_filters(message)
        return search_listings(**filters)

    if intent == 'booking_info' and decision.evidence.is_authenticated:
        return get_upcoming_bookings(user)

    if intent == 'personalized_recommendation' and decision.evidence.is_authenticated:
        return get_recommendations(user)

    return None


def _extract_search_filters(message: str) -> dict:
    """
    Extract simple search filters from the user's message.

    This is a basic keyword extraction. For Phase 1, it extracts destination names and activity types from the message.
    """
    from listings.models import ActivityType, Category

    message_lower = message.lower()
    filters = {}

    destinations = [
        'kathmandu', 'pokhara', 'chitwan', 'lumbini', 'nagarkot',
        'bhaktapur', 'patan', 'everest', 'annapurna', 'langtang',
        'manaslu', 'mustang', 'dolpo', 'rara', 'bardia', 'ilam',
    ]
    for destination in destinations:
        if destination in message_lower:
            filters['destination'] = destination
            break

    for choice_value, choice_label in ActivityType.choices:
        if choice_value in message_lower or choice_label.lower() in message_lower:
            filters['activity_type'] = choice_value
            break

    for choice_value, choice_label in Category.choices:
        if choice_value in message_lower or choice_label.lower() in message_lower:
            filters['category'] = choice_value
            break

    return filters


def _load_conversation_history(session) -> list[dict]:
    """
    Load recent messages from the session for prompt context.
    """
    max_messages = settings.CHATBOT_MAX_CONTEXT_MESSAGES
    messages = (
        ChatMessage.objects
        .filter(session=session)
        .order_by('-created_at')[1:max_messages + 1]
    )

    return [
        {'role': message.role, 'content': message.content}
        for message in reversed(messages)
    ]


def _build_prompt(decision: RouteDecision, message, context_data, conversation_history):
    """
    Build the appropriate prompt based on intent and context.
    """
    intent = decision.selected_route

    if intent == 'faq_help':
        return build_faq_prompt(message, context_data or [], conversation_history)

    if intent == 'listing_explain' and context_data:
        return build_listing_prompt(message, context_data, conversation_history)

    if intent == 'package_explain' and context_data:
        return build_package_prompt(message, context_data, conversation_history)

    if intent == 'booking_info':
        return build_booking_prompt(message, context_data or [], conversation_history)

    if intent == 'personalized_recommendation':
        return build_recommendation_prompt(message, context_data or [], conversation_history)

    if intent == 'general_suggestion':
        return build_general_suggestion_prompt(
            message,
            context_data or [],
            conversation_history,
            route_note=decision.prompt_note,
        )

    return build_fallback_prompt(message, conversation_history)
