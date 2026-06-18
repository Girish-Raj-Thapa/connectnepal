import logging

from django.conf import settings
from pgvector.django import CosineDistance

from chatbot.models import FAQEmbeddingIndex
from chatbot.services.embedding_service import generate_embedding

logger = logging.getLogger('chatbot')


def retrieve_faq_candidates(
    user_message: str,
    *,
    threshold: float | None = None,
    top_k: int | None = None,
) -> list[dict]:
    """
    Retrieve FAQ candidates for a user's question.

    Pipeline:
        - Embed the user message
        - Run cosine distance search on FAQEmbeddingIndex.embedding
        - Optionally filter by similarity threshold
        - Return top-k results

    Args:
        user_message: The user's question text.
        threshold: Optional cosine-distance filter. None returns the raw top-k results.
        top_k: Optional override for result count.

    Returns:
        List of dicts with keys: question, answer, category, distance.
    """
    try:
        query_vector = generate_embedding(user_message)
    except Exception as e:
        logger.error("Failed to embed user query for FAQ search: %s", str(e))
        return []

    if top_k is None:
        top_k = settings.CHATBOT_FAQ_TOP_K

    results = (
        FAQEmbeddingIndex.objects
        .select_related('faq_item', 'faq_item__category')
        .filter(
            faq_item__is_active=True,
            faq_item__show_in_chatbot=True,
            faq_item__category__is_active=True,
            embedding__isnull=False,
        )
        .annotate(distance=CosineDistance('embedding', query_vector))
        .order_by('distance')
        [:top_k]
    )

    serialized = [
        {
            'question': r.faq_item.question,
            'answer': r.faq_item.answer,
            'category': r.faq_item.category.name,
            'distance': float(r.distance),
        }
        for r in results
    ]

    if threshold is None:
        filtered = serialized
    else:
        filtered = [
            item
            for item in serialized
            if item['distance'] <= threshold
        ]

    logger.debug(
        "FAQ search for '%s': %d candidates, %d above threshold",
        user_message[:50], len(serialized), len(filtered),
    )

    return filtered


def retrieve_faq_context(user_message: str) -> list[dict]:
    """
    Retrieve the most relevant FAQ items for a user's question.

    Returns only items within the configured broad FAQ threshold.
    """
    return retrieve_faq_candidates(
        user_message,
        threshold=settings.CHATBOT_FAQ_SIMILARITY_THRESHOLD,
    )


def get_faq_fallback_response() -> str:
    """
    Return the grounded fallback used when FAQ retrieval finds no relevant matches.
    """
    return (
        "I don't have specific information about that in the current FAQ data. "
        "Try rephrasing your question or ask about accounts, bookings, payments, "
        "listings, packages, trip plans, or recommendations."
    )
