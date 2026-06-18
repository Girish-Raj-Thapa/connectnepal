from django.db.models import Prefetch

from pages.models import Page, FAQCategory, FAQItem
from utils.exceptions import ServiceError


def get_active_pages(kind: str | None = None, footer_only: bool = False):
    queryset = Page.objects.filter(is_active=True)

    if kind:
        queryset = queryset.filter(kind=kind)

    if footer_only:
        queryset = queryset.filter(show_in_footer=True)

    return queryset.order_by("sort_order", "title")


def get_page_by_slug(slug: str) -> Page:
    try:
        return Page.objects.get(slug=slug, is_active=True)
    except Page.DoesNotExist:
        raise ServiceError(
            detail="Page not found.",
            code="page_not_found",
            status_code=404,
        )


def get_public_faqs(category_slug: str | None = None):
    queryset = FAQItem.objects.filter(
        is_active=True,
        show_publicly=True,
        category__is_active=True,
    ).select_related("category")

    if category_slug:
        queryset = queryset.filter(category__slug=category_slug)

    return queryset.order_by("category__name", "sort_order", "question")


def get_public_faq_categories():
    return FAQCategory.objects.filter(
        is_active=True,
        faq_items__is_active=True,
        faq_items__show_publicly=True,
    ).distinct().order_by("name")


def get_public_faq_categories_with_items(category_slug: str | None = None):
    item_queryset = FAQItem.objects.filter(
        is_active=True,
        show_publicly=True,
    ).order_by("sort_order", "question")

    categories = FAQCategory.objects.filter(is_active=True)

    if category_slug:
        categories = categories.filter(slug=category_slug)

    categories = categories.filter(
        faq_items__is_active=True,
        faq_items__show_publicly=True,
    ).distinct().prefetch_related(
        Prefetch("faq_items", queryset=item_queryset, to_attr="public_items")
    )

    return categories.order_by("name")


def get_chatbot_pages():
    return Page.objects.filter(
        is_active=True,
        show_in_chatbot=True,
    ).order_by("kind", "sort_order", "title")


def get_chatbot_faqs():
    return FAQItem.objects.filter(
        is_active=True,
        show_in_chatbot=True,
        category__is_active=True,
    ).select_related("category").order_by("category__name", "sort_order", "question")
