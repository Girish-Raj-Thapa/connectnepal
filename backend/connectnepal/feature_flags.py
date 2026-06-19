from django.conf import settings


def chatbot_enabled() -> bool:
    return bool(getattr(settings, "ENABLE_CHATBOT", False))


def recommendations_enabled() -> bool:
    return bool(getattr(settings, "ENABLE_RECOMMENDATIONS", False))
