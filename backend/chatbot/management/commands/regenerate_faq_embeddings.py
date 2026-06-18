from django.core.management.base import BaseCommand

from chatbot.services.faq_service import regenerate_embeddings_for_items


class Command(BaseCommand):
    help = 'Regenerate embeddings for all active chatbot-approved FAQ items.'

    def handle(self, *args, **options):
        self.stdout.write('Regenerating FAQ embeddings...')
        count = regenerate_embeddings_for_items()
        self.stdout.write(self.style.SUCCESS(f'Done. {count} FAQ items embedded.'))
