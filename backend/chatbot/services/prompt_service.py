import logging

from django.conf import settings

logger = logging.getLogger('chatbot')


# SYSTEM PREAMBLE (shared across all prompts)

SYSTEM_PREAMBLE = """You are the ConnectNepal travel assistant, a helpful chatbot for a Nepal tourism booking platform.

Rules you must follow:
- Only answer based on the provided context. Do not make up information.
- If you do not have enough information to answer, say so honestly.
- Do not discuss topics unrelated to Nepal travel, tourism, or the ConnectNepal platform.
- Keep responses concise and helpful. Use plain language.
- Do not provide medical, legal, or financial advice.
- When mentioning prices, always note they are in NPR (Nepalese Rupees).
- Do not reveal internal system details, database structures, or technical implementation."""


# FAQ RAG PROMPT

FAQ_RAG_PROMPT_TEMPLATE = """{system_preamble}

You are answering a platform help question. Use ONLY the FAQ information provided below to answer.
If the FAQ items do not contain relevant information, say "I don't have specific information about that. Please contact our support team for help."

--- FAQ Knowledge Base ---
{faq_context}
--- End FAQ ---

{conversation_history}

User: {user_message}
Assistant:"""


# LISTING EXPLANATION PROMPT

LISTING_EXPLAIN_PROMPT_TEMPLATE = """{system_preamble}

You are explaining a travel experience listing to a traveller. Use the listing details below to give a helpful, informative explanation. Highlight key details like what's included, difficulty, duration, and price. If the user asked a specific question about the listing, focus your answer on that.

--- Listing Details ---
Title: {title}
Destination: {destination}
Location: {location}
Category: {category}
Activity Type: {activity_type}
Difficulty: {difficulty_level}
Ideal For: {ideal_for}
Price: NPR {price_per_person} per person
Duration: {duration_display}
What to Bring: {what_to_bring}
Requirements: {requirements}
Inclusions: {inclusions}
Exclusions: {exclusions}
Cancellation Policy: {cancellation_policy}
Languages: {languages_offered}
Best Seasons: {best_seasons}
Rating: {rating_average}/5 ({rating_count} reviews)
Bookings: {booking_count} completed
Group Size: {min_group_size}-{max_group_size} people
Instant Booking: {instant_booking}
Host: {host_name}
Description: {description}
--- End Listing ---

{conversation_history}

User: {user_message}
Assistant:"""


# PACKAGE EXPLANATION PROMPT

PACKAGE_EXPLAIN_PROMPT_TEMPLATE = """{system_preamble}

You are explaining a travel package to a traveller. Use the package details below to give a helpful overview. Highlight what's included, the itinerary, price, and any special features.

--- Package Details ---
Title: {title}
Duration: {duration_days} days / {duration_nights} nights
Price: NPR {total_price} per person
{discount_label_line}Max Group Size: {max_group_size}
Tags: {tags}
Inclusions: {inclusions}
Highlights: {highlights}
Terms: {terms_and_conditions}
Validity: {validity}
Rating: {rating_average}/5 ({rating_count} reviews)
Bookings: {booking_count} completed
Host: {host_name}
Description: {description}

Itinerary (Included Experiences):
{itinerary}
--- End Package ---

{conversation_history}

User: {user_message}
Assistant:"""


# BOOKING SUMMARY PROMPT

BOOKING_SUMMARY_PROMPT_TEMPLATE = """{system_preamble}

You are summarising the traveller's bookings. Use ONLY the booking data below. Present the information clearly and helpfully. If there are no bookings, let the user know.

--- Traveller's Bookings ---
{booking_data}
--- End Bookings ---

{conversation_history}

User: {user_message}
Assistant:"""


# RECOMMENDATION PROMPT

RECOMMENDATION_PROMPT_TEMPLATE = """{system_preamble}

You are presenting personalised travel recommendations to the traveller. Use ONLY the recommendations below. Present them in an engaging way, highlighting what makes each one appealing. If there are no recommendations, suggest the traveller explore the platform's listings.

--- Personalised Recommendations ---
{recommendation_data}
--- End Recommendations ---

{conversation_history}

User: {user_message}
Assistant:"""


# GENERAL SUGGESTION PROMPT

GENERAL_SUGGESTION_PROMPT_TEMPLATE = """{system_preamble}

You are suggesting travel experiences in Nepal based on what's available on the platform. Use ONLY the listings below to make suggestions. If no listings match, say there are no matching experiences currently available and suggest broadening the search.
{route_note}

--- Available Experiences ---
{listings_data}
--- End Experiences ---

{conversation_history}

User: {user_message}
Assistant:"""


# FALLBACK PROMPT

FALLBACK_PROMPT_TEMPLATE = """{system_preamble}

The user has sent a message that may be a greeting, off-topic, or unclear. Respond politely and guide them toward what you can help with:
- Answering questions about the ConnectNepal platform
- Explaining travel listings and packages
- Providing travel suggestions for Nepal
- Summarising bookings (for logged-in users)
- Giving personalised recommendations (for logged-in users)

{conversation_history}

User: {user_message}
Assistant:"""


# HELPER FUNCTIONS

def format_conversation_history(
    messages: list[dict],
    max_messages: int = None,
    include_roles: set[str] | None = None,
) -> str:
    """
    Format recent conversation messages for inclusion in the prompt.

    Args:
        messages: List of dicts with 'role' and 'content' keys.
        max_messages: Maximum number of messages to include. Defaults to settings value.
        include_roles: Optional set of roles to keep. None keeps all roles.

    Returns:
        Formatted string of conversation history, or empty string if no history.
    """
    if max_messages is None:
        max_messages = settings.CHATBOT_MAX_CONTEXT_MESSAGES

    if not messages:
        return ""

    if include_roles is not None:
        messages = [
            message
            for message in messages
            if message['role'] in include_roles
        ]

    if not messages:
        return ""

    recent = messages[-max_messages:]
    lines = ["Previous conversation:"]
    for msg in recent:
        role = "User" if msg['role'] == 'user' else "Assistant"
        lines.append(f"{role}: {msg['content']}")

    return "\n".join(lines)


def build_faq_prompt(user_message: str, faq_results: list[dict], conversation_history: list[dict]) -> str:
    """
    Build the FAQ RAG prompt with retrieved FAQ context.
    """
    context_block = ""
    if faq_results:
        for i, faq in enumerate(faq_results, 1):
            context_block += f"\nFAQ {i}:\n"
            context_block += f"Q: {faq['question']}\n"
            context_block += f"A: {faq['answer']}\n"
    else:
        context_block = "\nNo matching FAQ items found.\n"

    return FAQ_RAG_PROMPT_TEMPLATE.format(
        system_preamble=SYSTEM_PREAMBLE,
        faq_context=context_block,
        conversation_history=format_conversation_history(
            conversation_history,
            max_messages=2,
            include_roles={'user'},
        ),
        user_message=user_message,
    )


def build_listing_prompt(user_message: str, listing_data: dict, conversation_history: list[dict]) -> str:
    """
    Build the listing explanation prompt with fetched listing data.
    """
    return LISTING_EXPLAIN_PROMPT_TEMPLATE.format(
        system_preamble=SYSTEM_PREAMBLE,
        title=listing_data['title'],
        destination=listing_data['destination'],
        location=listing_data['location'],
        category=listing_data['category'],
        activity_type=listing_data['activity_type'],
        difficulty_level=listing_data['difficulty_level'],
        ideal_for=', '.join(listing_data['ideal_for']) if listing_data['ideal_for'] else 'Everyone',
        price_per_person=listing_data['price_per_person'],
        duration_display=listing_data['duration_display'],
        what_to_bring=listing_data['what_to_bring'] or 'Not specified',
        requirements=listing_data['requirements'] or 'None',
        inclusions=', '.join(listing_data['inclusions']) if listing_data['inclusions'] else 'Not specified',
        exclusions=', '.join(listing_data['exclusions']) if listing_data['exclusions'] else 'Not specified',
        cancellation_policy=listing_data['cancellation_policy'],
        languages_offered=', '.join(listing_data['languages_offered']) if listing_data['languages_offered'] else 'Not specified',
        best_seasons=', '.join(listing_data['best_seasons']) if listing_data['best_seasons'] else 'Year round',
        rating_average=listing_data['rating_average'],
        rating_count=listing_data['rating_count'],
        booking_count=listing_data['booking_count'],
        min_group_size=listing_data['min_group_size'],
        max_group_size=listing_data['max_group_size'],
        instant_booking='Yes' if listing_data['instant_booking'] else 'No',
        host_name=listing_data['host_name'],
        description=listing_data['description'][:1500],
        conversation_history=format_conversation_history(conversation_history),
        user_message=user_message,
    )


def build_package_prompt(user_message: str, package_data: dict, conversation_history: list[dict]) -> str:
    """
    Build the package explanation prompt with fetched package data.
    """
    itinerary_lines = []
    for item in package_data.get('included_listings', []):
        day = f"Day {item['day_number']}" if item['day_number'] else "Flexible"
        line = f"  {day}: {item['title']} ({item['activity_type']}) in {item['destination']}"
        if item['notes']:
            line += f" — {item['notes']}"
        itinerary_lines.append(line)
    itinerary = "\n".join(itinerary_lines) if itinerary_lines else "  No specific itinerary listed."

    valid_from = package_data.get('valid_from')
    valid_until = package_data.get('valid_until')
    if valid_from and valid_until:
        validity = f"{valid_from} to {valid_until}"
    elif valid_from:
        validity = f"From {valid_from}"
    elif valid_until:
        validity = f"Until {valid_until}"
    else:
        validity = "No specific validity period"

    discount = package_data.get('discount_label', '')
    discount_label_line = f"Discount: {discount}\n" if discount else ""

    return PACKAGE_EXPLAIN_PROMPT_TEMPLATE.format(
        system_preamble=SYSTEM_PREAMBLE,
        title=package_data['title'],
        duration_days=package_data['duration_days'],
        duration_nights=package_data['duration_nights'],
        total_price=package_data['total_price'],
        discount_label_line=discount_label_line,
        max_group_size=package_data['max_group_size'],
        tags=', '.join(package_data['tags']) if package_data['tags'] else 'None',
        inclusions=', '.join(package_data['inclusions']) if package_data['inclusions'] else 'Not specified',
        highlights=package_data['highlights'] or 'Not specified',
        terms_and_conditions=package_data['terms_and_conditions'] or 'Standard terms apply',
        validity=validity,
        rating_average=package_data['rating_average'],
        rating_count=package_data['rating_count'],
        booking_count=package_data['booking_count'],
        host_name=package_data['host_name'],
        description=package_data['description'][:1500],
        itinerary=itinerary,
        conversation_history=format_conversation_history(conversation_history),
        user_message=user_message,
    )


def build_booking_prompt(user_message: str, bookings: list[dict], conversation_history: list[dict]) -> str:
    """
    Build the booking summary prompt with fetched booking data.
    """
    if not bookings:
        booking_data = "No upcoming bookings found."
    else:
        lines = []
        for booking in bookings:
            lines.append(
                f"Booking {booking['reference']} — Status: {booking['status']}, Total: NPR {booking['total']}"
            )
            for item in booking['items']:
                title = item['listing_title'] or item['package_title'] or 'Unknown'
                lines.append(
                    f"  - {title}: {item['start_date']} to {item['end_date']}, "
                    f"{item['traveller_count']} traveller(s), Status: {item['status']}"
                )
        booking_data = "\n".join(lines)

    return BOOKING_SUMMARY_PROMPT_TEMPLATE.format(
        system_preamble=SYSTEM_PREAMBLE,
        booking_data=booking_data,
        conversation_history=format_conversation_history(conversation_history),
        user_message=user_message,
    )


def build_recommendation_prompt(
    user_message: str,
    recommendations: list[dict],
    conversation_history: list[dict],
) -> str:
    """
    Build the recommendation prompt with fetched recommendation data.
    """
    if not recommendations:
        recommendation_data = "No personalised recommendations available at this time."
    else:
        lines = []
        for i, rec in enumerate(recommendations, 1):
            lines.append(
                f"{i}. {rec['title']} — {rec['destination']}, "
                f"{rec['category']}, NPR {rec['price_per_person']}/person, "
                f"Rating: {rec['rating_average']}/5, Duration: {rec['duration_display']}"
            )
        recommendation_data = "\n".join(lines)

    return RECOMMENDATION_PROMPT_TEMPLATE.format(
        system_preamble=SYSTEM_PREAMBLE,
        recommendation_data=recommendation_data,
        conversation_history=format_conversation_history(conversation_history),
        user_message=user_message,
    )


def build_general_suggestion_prompt(
    user_message: str,
    listings: list[dict],
    conversation_history: list[dict],
    route_note: str = "",
) -> str:
    """
    Build the general suggestion prompt with search results.
    """
    if not listings:
        listings_data = "No matching experiences found on the platform."
    else:
        lines = []
        for i, listing in enumerate(listings, 1):
            lines.append(
                f"{i}. {listing['title']} — {listing['destination']}, "
                f"{listing['category']}, {listing['activity_type']}, "
                f"NPR {listing['price_per_person']}/person, "
                f"Rating: {listing['rating_average']}/5, "
                f"Difficulty: {listing['difficulty_level']}, "
                f"Duration: {listing['duration_display']}"
            )
        listings_data = "\n".join(lines)

    return GENERAL_SUGGESTION_PROMPT_TEMPLATE.format(
        system_preamble=SYSTEM_PREAMBLE,
        route_note=f"\n{route_note}\n" if route_note else "",
        listings_data=listings_data,
        conversation_history=format_conversation_history(conversation_history),
        user_message=user_message,
    )


def build_fallback_prompt(user_message: str, conversation_history: list[dict]) -> str:
    """
    Build the fallback prompt for greetings and unclear messages.
    """
    return FALLBACK_PROMPT_TEMPLATE.format(
        system_preamble=SYSTEM_PREAMBLE,
        conversation_history=format_conversation_history(conversation_history),
        user_message=user_message,
    )
