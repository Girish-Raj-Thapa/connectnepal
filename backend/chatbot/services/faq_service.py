import logging

from chatbot.models import FAQEmbeddingIndex
from chatbot.services.embedding_service import generate_embedding
from pages.services import get_chatbot_faqs

logger = logging.getLogger('chatbot')


def regenerate_embeddings_for_items(faq_items=None):
    """
    Regenerate embeddings for approved FAQ items from the pages app.

    Args:
        faq_items: Optional queryset of FAQItem objects. If None, regenerates all active chatbot-approved FAQ items.

    Returns:
        Number of FAQ items successfully embedded.
    """
    if faq_items is None:
        faq_items = get_chatbot_faqs()

    count = 0
    for faq_item in faq_items:
        try:
            combined_text = f"{faq_item.question}\n{faq_item.answer}"
            embedding = generate_embedding(combined_text)
            FAQEmbeddingIndex.objects.update_or_create(
                faq_item=faq_item,
                defaults={'embedding': embedding},
            )
            count += 1
        except Exception as e:
            logger.error(
                "Failed to generate embedding for FAQ item %d: %s",
                faq_item.pk, str(e),
            )

    logger.info("Regenerated embeddings for %d FAQ items.", count)
    return count
