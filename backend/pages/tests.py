from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from pages.default_faqs import DEFAULT_FAQ_CATEGORIES
from pages.default_pages import DEFAULT_PAGES
from pages.models import FAQCategory, FAQItem, Page


class SeedPlatformFaqsCommandTests(TestCase):
    def test_seed_platform_faqs_creates_expected_records(self):
        call_command("seed_platform_faqs", stdout=StringIO())

        expected_item_count = sum(
            len(category["items"]) for category in DEFAULT_FAQ_CATEGORIES
        )

        self.assertEqual(FAQCategory.objects.count(), len(DEFAULT_FAQ_CATEGORIES))
        self.assertEqual(FAQItem.objects.count(), expected_item_count)
        self.assertFalse(FAQItem.objects.filter(is_active=False).exists())
        self.assertFalse(FAQItem.objects.filter(show_publicly=False).exists())
        self.assertFalse(FAQItem.objects.filter(show_in_chatbot=False).exists())

    def test_seed_platform_faqs_is_idempotent(self):
        call_command("seed_platform_faqs", stdout=StringIO())
        call_command("seed_platform_faqs", stdout=StringIO())

        expected_item_count = sum(
            len(category["items"]) for category in DEFAULT_FAQ_CATEGORIES
        )

        self.assertEqual(FAQCategory.objects.count(), len(DEFAULT_FAQ_CATEGORIES))
        self.assertEqual(FAQItem.objects.count(), expected_item_count)


class SeedPublicPagesCommandTests(TestCase):
    def test_seed_public_pages_creates_expected_records(self):
        call_command("seed_public_pages", stdout=StringIO())

        self.assertEqual(Page.objects.count(), len(DEFAULT_PAGES))
        self.assertEqual(
            set(Page.objects.values_list("slug", flat=True)),
            {
                "about-us",
                "contact-us",
                "community-guidelines",
                "how-it-works",
                "for-hosts",
                "privacy-policy",
                "terms-and-conditions",
                "refund-and-cancellation-policy",
                "trust-and-safety",
            },
        )
        self.assertFalse(Page.objects.filter(is_active=False).exists())
        self.assertFalse(Page.objects.filter(show_in_footer=False).exists())
        self.assertFalse(Page.objects.filter(show_in_chatbot=False).exists())

        about_page = Page.objects.get(slug="about-us")
        self.assertEqual(about_page.title, "About Us")
        self.assertEqual(about_page.kind, Page.Kind.ABOUT)
        self.assertIn("About ConnectNepal", about_page.content)
        self.assertIn("Our Mission", about_page.content)

        contact_page = Page.objects.get(slug="contact-us")
        self.assertEqual(contact_page.kind, Page.Kind.GENERAL)
        self.assertIn("info@connectnepal.com", contact_page.content)

        how_it_works_page = Page.objects.get(slug="how-it-works")
        self.assertEqual(how_it_works_page.kind, Page.Kind.HELP)
        self.assertIn("15 minutes", how_it_works_page.content)

        policy_page = Page.objects.get(slug="refund-and-cancellation-policy")
        self.assertEqual(policy_page.kind, Page.Kind.POLICY)
        self.assertIn("Flexible", policy_page.content)

        community_guidelines_page = Page.objects.get(slug="community-guidelines")
        self.assertEqual(community_guidelines_page.kind, Page.Kind.POLICY)
        self.assertIn("off-platform", community_guidelines_page.content)
        self.assertIn("harassment", community_guidelines_page.content)

        trust_and_safety_page = Page.objects.get(slug="trust-and-safety")
        self.assertEqual(trust_and_safety_page.kind, Page.Kind.POLICY)
        self.assertIn("emergency service", trust_and_safety_page.content)
        self.assertIn("fraud or scam behavior", trust_and_safety_page.content)

    def test_seed_public_pages_is_idempotent(self):
        call_command("seed_public_pages", stdout=StringIO())
        call_command("seed_public_pages", stdout=StringIO())

        self.assertEqual(Page.objects.count(), len(DEFAULT_PAGES))
        self.assertEqual(Page.objects.filter(slug="about-us").count(), 1)
        self.assertEqual(Page.objects.filter(slug="contact-us").count(), 1)
        self.assertEqual(Page.objects.filter(slug="community-guidelines").count(), 1)
        self.assertEqual(Page.objects.filter(slug="privacy-policy").count(), 1)
        self.assertEqual(Page.objects.filter(slug="trust-and-safety").count(), 1)
