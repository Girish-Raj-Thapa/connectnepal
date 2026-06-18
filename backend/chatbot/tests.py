import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from accounts.models import Account, HostDetail
from bookings.models import Booking, BookingItem, BookingItemStatus, BookingStatus
from chatbot.models import ChatMessage, ChatSession
from chatbot.services.chat_service import CHATBOT_ERROR_REPLY, handle_chat_message
from chatbot.services.prompt_service import build_faq_prompt
from chatbot.services.rag_service import get_faq_fallback_response
from chatbot.services.router_service import (
    BOOKINGS_LOGIN_REQUIRED_REPLY,
    ENTITY_CONTEXT_REQUIRED_REPLY,
    GUEST_GREETING_REPLY,
    RouteCandidate,
    RouteDecision,
    RoutingEvidence,
    route_message,
)
from chatbot.services.tool_service import fetch_listing, get_upcoming_bookings, search_listings
from listings.models import (
    ActivityType,
    CancellationPolicy,
    Category,
    DifficultyLevel,
    DurationType,
    Listing,
)
from utils.exceptions import ServiceError


def _faq_candidate(
    *,
    distance: float,
    question: str = "FAQ question",
    answer: str = "FAQ answer",
    category: str = "Help",
) -> dict:
    return {
        'question': question,
        'answer': answer,
        'category': category,
        'distance': distance,
    }


class RouterServiceTests(TestCase):
    @patch("chatbot.services.router_service.retrieve_faq_candidates")
    def test_guest_booking_capability_question_routes_to_faq(self, mock_retrieve_faq_candidates):
        mock_retrieve_faq_candidates.return_value = [
            _faq_candidate(
                distance=0.2,
                question="Can I book as a guest without logging in?",
                answer="No. Booking requires a traveller account.",
            ),
        ]

        decision = route_message(
            message="Can I book as a guest without logging in?",
        )

        self.assertEqual(decision.selected_route, "faq_help")
        self.assertEqual(decision.fixed_reply, "No. Booking requires a traveller account.")
        self.assertEqual(decision.evidence.faq_results[0]['question'], "Can I book as a guest without logging in?")

    @patch("chatbot.services.router_service.retrieve_faq_candidates")
    def test_payment_window_question_routes_to_faq(self, mock_retrieve_faq_candidates):
        mock_retrieve_faq_candidates.return_value = [
            _faq_candidate(
                distance=0.2,
                question="How long do I have to pay after creating a booking?",
                answer="You have 15 minutes to pay before the booking expires.",
            ),
        ]

        decision = route_message(
            message="How long do I have to pay after creating a booking?",
        )

        self.assertEqual(decision.selected_route, "faq_help")
        self.assertEqual(decision.fixed_reply, "You have 15 minutes to pay before the booking expires.")

    @patch("chatbot.services.router_service.retrieve_faq_candidates")
    def test_guest_personalized_capability_question_routes_to_faq(self, mock_retrieve_faq_candidates):
        mock_retrieve_faq_candidates.return_value = [
            _faq_candidate(
                distance=0.21,
                question="Can guests get personalized recommendations?",
                answer="No. Personalized recommendations require login.",
            ),
        ]

        decision = route_message(
            message="Can guests get personalized recommendations?",
        )

        self.assertEqual(decision.selected_route, "faq_help")
        self.assertEqual(decision.fixed_reply, "No. Personalized recommendations require login.")

    def test_upcoming_bookings_guest_gets_fixed_login_reply(self):
        decision = route_message(message="Show my upcoming bookings")

        self.assertEqual(decision.selected_route, "booking_info")
        self.assertEqual(decision.fixed_reply, BOOKINGS_LOGIN_REQUIRED_REPLY)
        self.assertEqual(decision.downgrade_reason, "authentication_required")

    def test_guest_personalized_request_downgrades_to_general_suggestion(self):
        decision = route_message(message="Give me personalized recommendations")

        self.assertEqual(decision.selected_route, "general_suggestion")
        self.assertEqual(decision.downgrade_from, "personalized_recommendation")
        self.assertEqual(decision.downgrade_reason, "authentication_required")
        self.assertTrue(decision.prompt_note)

    def test_package_question_without_context_gets_fixed_reply(self):
        decision = route_message(message="What is included in this package?")

        self.assertEqual(decision.selected_route, "package_explain")
        self.assertEqual(decision.fixed_reply, ENTITY_CONTEXT_REQUIRED_REPLY)
        self.assertEqual(decision.downgrade_reason, "package_context_required")

    @patch("chatbot.services.router_service.retrieve_faq_candidates")
    def test_student_discount_question_uses_strict_faq_fallback_on_weak_match(
        self,
        mock_retrieve_faq_candidates,
    ):
        mock_retrieve_faq_candidates.return_value = [
            _faq_candidate(
                distance=0.42,
                question="What payment method is supported right now?",
                answer="The current payment method is eSewa.",
            ),
        ]

        decision = route_message(message="Do you offer student discounts?")

        self.assertEqual(decision.selected_route, "faq_help")
        self.assertEqual(decision.fixed_reply, get_faq_fallback_response())
        self.assertEqual(decision.evidence.faq_top_distance, 0.42)

    @patch("chatbot.services.router_service.score_capabilities_with_ollama")
    @patch("chatbot.services.router_service.retrieve_faq_candidates", return_value=[])
    def test_inconclusive_message_can_use_llm_tiebreaker(
        self,
        mock_retrieve_faq_candidates,
        mock_score_capabilities_with_ollama,
    ):
        mock_score_capabilities_with_ollama.return_value = [
            {
                'name': 'general_suggestion',
                'score': 0.77,
                'source': 'ollama',
                'reason': 'Broad travel planning question.',
            },
        ]

        decision = route_message(message="Plan something nice for Nepal")

        self.assertEqual(decision.selected_route, "general_suggestion")
        self.assertEqual(decision.candidates[0].source, "ollama")

    @patch("chatbot.services.router_service.fetch_listing")
    @patch("chatbot.services.router_service.score_capabilities_with_ollama", return_value=[])
    @patch("chatbot.services.router_service.retrieve_faq_candidates")
    def test_listing_context_does_not_hijack_unrelated_message(
        self,
        mock_retrieve_faq_candidates,
        mock_score_capabilities_with_ollama,
        mock_fetch_listing,
    ):
        decision = route_message(
            message="What can you do?",
            listing_id=123,
        )

        self.assertEqual(decision.selected_route, "fallback")
        mock_fetch_listing.assert_not_called()
        mock_retrieve_faq_candidates.assert_not_called()
        mock_score_capabilities_with_ollama.assert_called_once()

    @patch("chatbot.services.router_service.score_capabilities_with_ollama")
    @patch("chatbot.services.router_service.retrieve_faq_candidates")
    def test_general_suggestion_does_not_trigger_faq_retrieval(
        self,
        mock_retrieve_faq_candidates,
        mock_score_capabilities_with_ollama,
    ):
        decision = route_message(
            message="Suggest places for a weekend trip in Pokhara",
        )

        self.assertEqual(decision.selected_route, "general_suggestion")
        mock_retrieve_faq_candidates.assert_not_called()
        mock_score_capabilities_with_ollama.assert_not_called()

    def test_guest_greeting_returns_fixed_fast_reply(self):
        decision = route_message(message="ola")

        self.assertEqual(decision.selected_route, "fallback")
        self.assertEqual(decision.fixed_reply, GUEST_GREETING_REPLY)

    def test_authenticated_greeting_personalizes_first_name(self):
        user_model = get_user_model()
        user = user_model.objects.create_user(
            email="girish@example.com",
            role=user_model.Role.TRAVELLER,
            password="testpass123",
        )
        user.first_name = "girish raj"
        user.is_active = True
        user.save(update_fields=["first_name", "is_active"])

        decision = route_message(message="hello", user=user)

        self.assertEqual(decision.selected_route, "fallback")
        self.assertEqual(
            decision.fixed_reply,
            "Hi Girish! I'm here to help with ConnectNepal. Ask about your bookings, listings, packages, trip plans, or travel suggestions in Nepal.",
        )

    @patch("chatbot.services.router_service.fetch_listing")
    @patch("chatbot.services.router_service.retrieve_faq_candidates", return_value=[])
    def test_contextual_listing_followup_routes_to_listing_explain(
        self,
        mock_retrieve_faq_candidates,
        mock_fetch_listing,
    ):
        mock_fetch_listing.return_value = {'id': 123, 'title': 'Demo listing'}

        decision = route_message(
            message="Tell me more about this",
            listing_id=123,
        )

        self.assertEqual(decision.selected_route, "listing_explain")
        self.assertIsNotNone(decision.evidence.listing_data)
        mock_fetch_listing.assert_called_once_with(123)
        mock_retrieve_faq_candidates.assert_not_called()

    @patch("chatbot.services.router_service.fetch_package")
    @patch("chatbot.services.router_service.retrieve_faq_candidates", return_value=[])
    def test_contextual_package_followup_routes_to_package_explain(
        self,
        mock_retrieve_faq_candidates,
        mock_fetch_package,
    ):
        mock_fetch_package.return_value = {'id': 456, 'title': 'Demo package'}

        decision = route_message(
            message="What's included?",
            package_id=456,
        )

        self.assertEqual(decision.selected_route, "package_explain")
        self.assertIsNotNone(decision.evidence.package_data)
        mock_fetch_package.assert_called_once_with(456)
        mock_retrieve_faq_candidates.assert_not_called()

    @patch("chatbot.services.router_service.score_capabilities_with_ollama", return_value=[])
    @patch("chatbot.services.router_service.retrieve_faq_candidates", return_value=[])
    def test_contextual_followup_without_entity_context_does_not_force_entity_route(
        self,
        mock_retrieve_faq_candidates,
        mock_score_capabilities_with_ollama,
    ):
        decision = route_message(message="Tell me more about this")

        self.assertEqual(decision.selected_route, "fallback")
        mock_retrieve_faq_candidates.assert_not_called()
        mock_score_capabilities_with_ollama.assert_called_once()


class PromptServiceTests(TestCase):
    def test_faq_prompt_excludes_prior_assistant_messages(self):
        prompt = build_faq_prompt(
            user_message="How do I book a trip on ConnectNepal?",
            faq_results=[
                _faq_candidate(
                    distance=0.2,
                    question="How do I book a trip on ConnectNepal?",
                    answer="Choose a listing or package and pay with eSewa.",
                ),
            ],
            conversation_history=[
                {'role': 'assistant', 'content': 'Wrong older answer.'},
                {'role': 'user', 'content': 'I need help booking.'},
            ],
        )

        self.assertIn("User: I need help booking.", prompt)
        self.assertNotIn("Assistant: Wrong older answer.", prompt)


class HandleChatMessageRoutingTests(TestCase):
    @patch("chatbot.services.router_service.retrieve_faq_candidates")
    @patch("chatbot.services.chat_service.generate_response")
    def test_strong_faq_match_returns_stored_answer_directly(
        self,
        mock_generate_response,
        mock_retrieve_faq_candidates,
    ):
        mock_retrieve_faq_candidates.return_value = [
            _faq_candidate(
                distance=0.2,
                question="Can guests get personalized recommendations?",
                answer="No. Guests can browse public experiences, but personalized recommendations require login.",
            ),
        ]

        result = handle_chat_message(
            message="Can guests get personalized recommendations?",
            guest_session_id=str(uuid.uuid4()),
        )

        self.assertEqual(result["intent"], "faq_help")
        self.assertEqual(
            result["reply"],
            "No. Guests can browse public experiences, but personalized recommendations require login.",
        )
        mock_generate_response.assert_not_called()

    @patch("chatbot.services.chat_service.generate_response")
    def test_guest_greeting_uses_fixed_reply_without_model(self, mock_generate_response):
        result = handle_chat_message(
            message="hello there",
            guest_session_id=str(uuid.uuid4()),
        )

        self.assertEqual(result["intent"], "fallback")
        self.assertEqual(result["reply"], GUEST_GREETING_REPLY)
        mock_generate_response.assert_not_called()

    @patch("chatbot.services.chat_service.generate_response")
    def test_authenticated_greeting_uses_name_without_model(self, mock_generate_response):
        user_model = get_user_model()
        user = user_model.objects.create_user(
            email="traveller3@example.com",
            role=user_model.Role.TRAVELLER,
            password="testpass123",
        )
        user.first_name = "girish"
        user.last_name = "raj thapa"
        user.is_active = True
        user.save(update_fields=["first_name", "last_name", "is_active"])

        result = handle_chat_message(
            message="hi",
            user=user,
        )

        self.assertEqual(result["intent"], "fallback")
        self.assertEqual(
            result["reply"],
            "Hi Girish! I'm here to help with ConnectNepal. Ask about your bookings, listings, packages, trip plans, or travel suggestions in Nepal.",
        )
        mock_generate_response.assert_not_called()

    @patch("chatbot.services.router_service.retrieve_faq_candidates")
    @patch("chatbot.services.chat_service.generate_response")
    def test_faq_likely_question_without_strong_match_uses_grounded_fallback(
        self,
        mock_generate_response,
        mock_retrieve_faq_candidates,
    ):
        mock_retrieve_faq_candidates.return_value = [
            _faq_candidate(
                distance=0.42,
                question="What payment method is supported right now?",
                answer="The current payment method is eSewa.",
            ),
        ]

        result = handle_chat_message(
            message="Do you offer student discounts?",
            guest_session_id=str(uuid.uuid4()),
        )

        self.assertEqual(result["intent"], "faq_help")
        self.assertEqual(result["reply"], get_faq_fallback_response())
        mock_generate_response.assert_not_called()

        assistant_message = ChatMessage.objects.get(role=ChatMessage.Role.ASSISTANT)
        self.assertEqual(assistant_message.intent, "faq_help")
        self.assertEqual(assistant_message.metadata["downgrade_reason"], "faq_match_missing_or_weak")

    @patch("chatbot.services.router_service.retrieve_faq_candidates", return_value=[])
    @patch("chatbot.services.chat_service.search_listings")
    @patch("chatbot.services.chat_service.generate_response", return_value="Log in for personalized results. Here are some general suggestions.")
    def test_guest_personalized_request_downgrades_to_general_prompt(
        self,
        mock_generate_response,
        mock_search_listings,
        mock_retrieve_faq_candidates,
    ):
        mock_search_listings.return_value = [
            {
                'id': 1,
                'title': 'Pokhara Escape',
                'destination': 'Pokhara',
                'category': 'Adventure',
                'activity_type': 'Boating',
                'price_per_person': '2500.00',
                'duration_display': '1 day',
                'rating_average': '4.5',
                'rating_count': 12,
                'difficulty_level': 'Easy',
            },
        ]

        result = handle_chat_message(
            message="Give me personalized recommendations",
            guest_session_id=str(uuid.uuid4()),
        )

        self.assertEqual(result["intent"], "general_suggestion")
        self.assertEqual(
            result["reply"],
            "Log in for personalized results. Here are some general suggestions.",
        )
        prompt = mock_generate_response.call_args[0][0]
        self.assertIn("personalized recommendations require login", prompt.lower())

        assistant_message = ChatMessage.objects.get(role=ChatMessage.Role.ASSISTANT)
        self.assertEqual(assistant_message.metadata["downgrade_from"], "personalized_recommendation")

    @patch("chatbot.services.chat_service.route_message")
    def test_guest_session_is_claimed_on_login(self, mock_route_message):
        mock_route_message.return_value = RouteDecision(
            selected_route="fallback",
            candidates=[
                RouteCandidate(
                    name="fallback",
                    score=0.95,
                    source="test",
                    reason="Deterministic test route.",
                ),
            ],
            evidence=RoutingEvidence(),
            fixed_reply="Hello from test router.",
        )
        guest_session_id = str(uuid.uuid4())

        first_result = handle_chat_message(
            message="hi",
            guest_session_id=guest_session_id,
        )
        session = ChatSession.objects.get(pk=first_result["session_id"])
        self.assertIsNone(session.user)

        user_model = get_user_model()
        user = user_model.objects.create_user(
            email="traveller@example.com",
            role=user_model.Role.TRAVELLER,
            password="testpass123",
        )
        user.is_active = True
        user.save(update_fields=["is_active"])

        second_result = handle_chat_message(
            message="hello again",
            user=user,
            session_id=session.pk,
            guest_session_id=guest_session_id,
        )

        session.refresh_from_db()
        self.assertEqual(second_result["session_id"], session.pk)
        self.assertEqual(session.user, user)

    @patch("chatbot.services.chat_service.route_message")
    def test_user_owned_session_cannot_be_resumed_as_guest(self, mock_route_message):
        mock_route_message.return_value = RouteDecision(
            selected_route="fallback",
            candidates=[],
            evidence=RoutingEvidence(),
            fixed_reply="Hello from test router.",
        )

        user_model = get_user_model()
        user = user_model.objects.create_user(
            email="traveller2@example.com",
            role=user_model.Role.TRAVELLER,
            password="testpass123",
        )
        user.is_active = True
        user.save(update_fields=["is_active"])

        first_result = handle_chat_message(
            message="hi",
            user=user,
        )

        with self.assertRaises(ServiceError) as exc:
            handle_chat_message(
                message="hello",
                session_id=first_result["session_id"],
                guest_session_id=str(uuid.uuid4()),
            )

        self.assertEqual(exc.exception.status_code, 403)

    @patch("chatbot.services.chat_service.route_message")
    def test_route_failure_returns_fallback_reply_and_persists_assistant_message(self, mock_route_message):
        mock_route_message.side_effect = RuntimeError("routing backend unavailable")

        result = handle_chat_message(
            message="Can you help me plan a trip?",
            guest_session_id=str(uuid.uuid4()),
        )

        session = ChatSession.objects.get(pk=result["session_id"])
        messages = list(session.messages.order_by("created_at"))

        self.assertEqual(result["intent"], "fallback")
        self.assertEqual(result["reply"], CHATBOT_ERROR_REPLY)
        self.assertEqual(len(messages), 2)
        self.assertEqual(messages[0].role, ChatMessage.Role.USER)
        self.assertEqual(messages[1].role, ChatMessage.Role.ASSISTANT)
        self.assertEqual(messages[1].content, CHATBOT_ERROR_REPLY)
        self.assertEqual(messages[1].intent, "fallback")
        self.assertEqual(messages[1].metadata["error"], "internal_error")


class ToolServiceSoftDeleteTests(TestCase):
    account_seq = 0

    def create_account(self, role, **overrides):
        self.__class__.account_seq += 1
        seq = self.__class__.account_seq
        defaults = {
            "email": f"{role}-{seq}@example.com",
            "role": role,
            "first_name": "Test",
            "last_name": "User",
            "is_active": True,
        }
        defaults.update(overrides)
        return Account.objects.create(**defaults)

    def create_host(self):
        user = self.create_account(Account.Role.HOST)
        host = HostDetail.objects.create(
            user=user,
            business_name="Chatbot Host Co.",
            verification_status=HostDetail.VerificationStatus.APPROVED,
        )
        return user, host

    def create_listing(self, host, **overrides):
        defaults = {
            "host": host,
            "title": "Chatbot Listing",
            "description": "Listing for chatbot tool tests.",
            "destination": "Pokhara",
            "location": "Lakeside",
            "category": Category.CULTURAL,
            "activity_type": ActivityType.CITY_TOUR,
            "difficulty_level": DifficultyLevel.EASY,
            "ideal_for": ["solo"],
            "price_per_person": "1200.00",
            "duration_type": DurationType.FULL_DAY,
            "duration_days": 1,
            "duration_nights": 0,
            "tags": ["walk"],
            "what_to_bring": "Shoes",
            "requirements": "None",
            "inclusions": ["Guide"],
            "exclusions": ["Meals"],
            "cancellation_policy": CancellationPolicy.MODERATE,
            "languages_offered": ["english"],
            "best_seasons": ["autumn"],
            "is_active": True,
            "is_bookable": True,
        }
        defaults.update(overrides)
        return Listing.objects.create(**defaults)

    def test_get_upcoming_bookings_uses_snapshot_titles(self):
        traveller = self.create_account(Account.Role.TRAVELLER)
        _, host = self.create_host()
        listing = self.create_listing(host, title="Original Chatbot Listing")
        booking = Booking.objects.create(
            traveller=traveller,
            status=BookingStatus.CONFIRMED,
            expires_at=timezone.now(),
        )
        BookingItem.objects.create(
            booking=booking,
            listing=listing,
            duration_type=listing.duration_type,
            start_date=timezone.localdate(),
            end_date=timezone.localdate(),
            days=1,
            nights=0,
            traveller_count=1,
            status=BookingItemStatus.CONFIRMED,
            snapshot={"title": "Snapshot Chatbot Listing"},
            price_per_person=listing.price_per_person,
            subtotal=listing.price_per_person,
            quoted_total=listing.price_per_person,
        )

        listing.title = "Live Chatbot Listing"
        listing.is_active = False
        listing.is_bookable = False
        listing.save(update_fields=["title", "is_active", "is_bookable"])

        results = get_upcoming_bookings(traveller)
        self.assertEqual(
            results[0]["items"][0]["listing_title"],
            "Snapshot Chatbot Listing",
        )

    def test_fetch_listing_and_search_hide_blocked_host_content(self):
        _, active_host = self.create_host()
        blocked_user, blocked_host = self.create_host()
        visible_listing = self.create_listing(active_host, title="Visible Chatbot Listing")
        hidden_listing = self.create_listing(blocked_host, title="Hidden Chatbot Listing")

        blocked_user.is_active = False
        blocked_user.save(update_fields=["is_active"])

        self.assertIsNotNone(fetch_listing(visible_listing.pk))
        self.assertIsNone(fetch_listing(hidden_listing.pk))

        results = search_listings(destination="Pokhara")
        result_ids = {item["id"] for item in results}
        self.assertIn(visible_listing.pk, result_ids)
        self.assertNotIn(hidden_listing.pk, result_ids)
