from django.conf import settings
from django.db import models
from pgvector.django import VectorField


class ChatSession(models.Model):
    """
    A conversation session between a user and the chatbot.

    Guest users are tracked via guest_session_id (a UUID).
    
    Authenticated travellers are linked via the user FK.

    A session can start as guest and be claimed by a user after login.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='chat_sessions',
        help_text="Authenticated user. Null for guest sessions.",
    )

    guest_session_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Frontend-generated UUID for guest session tracking.",
    )

    title = models.CharField(
        max_length=255,
        blank=True,
        help_text="Auto-generated from first user message, truncated to 255 chars.",
    )

    is_active = models.BooleanField(
        default=True,
        help_text="Inactive sessions are soft-deleted / archived.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at']),
            models.Index(fields=['guest_session_id', '-updated_at']),
        ]

    def __str__(self):
        owner = self.user.email if self.user else f"guest:{self.guest_session_id}"
        return f"ChatSession #{self.pk} ({owner})"
    

class ChatMessage(models.Model):
    """
    A single message in a chat session.

    role='user' for traveller messages, role='assistant' for chatbot responses.
    """
    class Role(models.TextChoices):
        USER = 'user', 'User'
        ASSISTANT = 'assistant', 'Assistant'

    session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name='messages',
    )

    role = models.CharField(
        max_length=10,
        choices=Role.choices,
    )

    content = models.TextField(
        help_text="The message text.",
    )

    intent = models.CharField(
        max_length=50,
        blank=True,
        help_text="Detected intent for this turn (e.g., 'faq_help', 'listing_explain').",
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Optional metadata: tool results, RAG sources, model used, latency, etc.",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['session', 'created_at']),
        ]

    def __str__(self):
        preview = self.content[:50]
        return f"{self.role} in session {self.session_id}: {preview}"


class FAQEmbeddingIndex(models.Model):
    """
    Vector index record for a FAQ item owned by the pages app.

    The source-of-truth FAQ content lives in pages.FAQItem / pages.FAQCategory.

    This model stores only the embedding needed for chatbot retrieval.
    """
    faq_item = models.OneToOneField(
        'pages.FAQItem',
        on_delete=models.CASCADE,
        related_name='chatbot_embedding',
        help_text="The FAQ item whose question/answer text is indexed for chatbot retrieval.",
    )

    embedding = VectorField(
        dimensions=768,
        null=True,
        blank=True,
        help_text="768-dim embedding from nomic-embed-text via Ollama.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'FAQ embedding index'
        verbose_name_plural = 'FAQ embedding indexes'

    def __str__(self):
        return self.faq_item.question[:80]

    @property
    def combined_text(self):
        """Question + answer text used for embedding generation."""
        return f"{self.faq_item.question}\n{self.faq_item.answer}"
    
