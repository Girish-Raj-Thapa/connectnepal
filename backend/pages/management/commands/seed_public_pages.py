from django.core.management.base import BaseCommand
from django.db import transaction

from pages.default_pages import DEFAULT_PAGES
from pages.models import Page


class Command(BaseCommand):
    help = "Seed default public CMS pages such as About Us, Contact Us, and policy pages."

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        with transaction.atomic():
            for page_data in DEFAULT_PAGES:
                _, created = Page.objects.update_or_create(
                    slug=page_data["slug"],
                    defaults={
                        "title": page_data["title"],
                        "kind": page_data["kind"],
                        "content": page_data["content"],
                        "is_active": page_data["is_active"],
                        "show_in_footer": page_data["show_in_footer"],
                        "show_in_chatbot": page_data["show_in_chatbot"],
                        "sort_order": page_data["sort_order"],
                    },
                )
                if created:
                    created_count += 1
                else:
                    updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded public pages: {created_count} created, {updated_count} updated."
            )
        )
