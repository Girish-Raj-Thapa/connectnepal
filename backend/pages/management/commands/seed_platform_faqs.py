from django.core.management.base import BaseCommand
from django.db import transaction

from chatbot.services.faq_service import regenerate_embeddings_for_items
from pages.default_faqs import DEFAULT_FAQ_CATEGORIES
from pages.models import FAQCategory, FAQItem


class Command(BaseCommand):
    help = (
        "Seed grounded FAQ categories and items for public pages and chatbot retrieval."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--regenerate-embeddings",
            action="store_true",
            help="Regenerate embeddings for the seeded FAQ items after writing them.",
        )

    def handle(self, *args, **options):
        created_categories = 0
        updated_categories = 0
        created_items = 0
        updated_items = 0
        seeded_item_ids = []

        with transaction.atomic():
            for category_data in DEFAULT_FAQ_CATEGORIES:
                category, category_created = FAQCategory.objects.update_or_create(
                    slug=category_data["slug"],
                    defaults={
                        "name": category_data["name"],
                        "is_active": True,
                    },
                )
                if category_created:
                    created_categories += 1
                else:
                    updated_categories += 1

                for sort_order, item_data in enumerate(category_data["items"], start=1):
                    faq_item, item_created = FAQItem.objects.update_or_create(
                        category=category,
                        question=item_data["question"],
                        defaults={
                            "answer": item_data["answer"],
                            "is_active": True,
                            "show_publicly": True,
                            "show_in_chatbot": True,
                            "sort_order": sort_order * 10,
                        },
                    )
                    seeded_item_ids.append(faq_item.pk)

                    if item_created:
                        created_items += 1
                    else:
                        updated_items += 1

        self.stdout.write(
            self.style.SUCCESS(
                "Seeded platform FAQs: "
                f"{created_categories} categories created, "
                f"{updated_categories} categories updated, "
                f"{created_items} items created, "
                f"{updated_items} items updated."
            )
        )

        if options["regenerate_embeddings"]:
            seeded_items = FAQItem.objects.filter(pk__in=seeded_item_ids).select_related("category")
            count = regenerate_embeddings_for_items(seeded_items)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Regenerated embeddings for {count} seeded FAQ items."
                )
            )
