from django.db import models


class Page(models.Model):
    class Kind(models.TextChoices):
        GENERAL = "general", "General"
        ABOUT = "about", "About"
        POLICY = "policy", "Policy"
        HELP = "help", "Help"
    
    title = models.CharField(max_length=255)
    slug = models.SlugField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text="Stable public identifier used in frontend and API URLs.",
    )
    kind = models.CharField(
        max_length=20,
        choices=Kind.choices,
        default=Kind.GENERAL,
        db_index=True,
    )
    content = models.TextField(
        help_text=(
            "Long-form page body. Keep this simple: plain text, markdown, or "
            "HTML string depending the editor strategy chosen later."
        )
    )
    is_active = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Only active pages should be returned by public APIs.",
    )
    show_in_footer = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Useful for frontend footer navigation or help menus.",
    )
    show_in_chatbot = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Only approved pages should be exposed to future chatbot retrieval.",
    )
    sort_order = models.PositiveIntegerField(
        default=0,
        help_text="Lower numbers appear first in ordered page lists.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "title"]

    def __str__(self):
        return self.title


class FAQCategory(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(
        max_length=120,
        unique=True,
        db_index=True,
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Inactive categories should not appear in public FAQ APIs.",
    )

    class Meta:
        verbose_name = "FAQ category"
        verbose_name_plural = "FAQ categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class FAQItem(models.Model):
    category = models.ForeignKey(
        FAQCategory,
        on_delete=models.CASCADE,
        related_name="faq_items",
    )
    question = models.CharField(max_length=255)
    answer = models.TextField()
    is_active = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Draft or retired FAQ items should stay inactive.",
    )
    show_publicly = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Controls whether this FAQ should appear in public frontend APIs.",
    )
    show_in_chatbot = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Controls whether this FAQ is approved for chatbot retrieval later.",
    )
    sort_order = models.PositiveIntegerField(
        default=0,
        help_text="Lower numbers appear first inside each FAQ category.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "question"]

    def __str__(self):
        return self.question

