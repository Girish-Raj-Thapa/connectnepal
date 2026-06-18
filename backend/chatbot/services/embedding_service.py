import logging

import requests
from django.conf import settings

logger = logging.getLogger('chatbot')


def generate_embedding(text: str) -> list[float]:
    """
    Generate a vector embedding for the given text using Ollama.

    Args:
        text: The text to embed.

    Returns:
        A list of floats representing the embedding vector (768 dimensions).

    Raises:
        ConnectionError: If Ollama is not running.
        ValueError: If the response format is unexpected.
    """
    try:
        response = requests.post(
            f"{settings.OLLAMA_BASE_URL}/api/embed",
            json={
                "model": settings.OLLAMA_EMBEDDING_MODEL,
                "input": text,
            },
            timeout=settings.OLLAMA_EMBEDDING_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()

        embeddings = data.get("embeddings")
        if not embeddings or not embeddings[0]:
            raise ValueError("Empty embedding returned from Ollama.")

        return embeddings[0]

    except requests.ConnectionError:
        logger.error("Ollama is not running at %s", settings.OLLAMA_BASE_URL)
        raise ConnectionError(
            f"Cannot connect to Ollama at {settings.OLLAMA_BASE_URL}. "
            "Make sure Ollama is running with 'ollama serve'."
        )
    except requests.Timeout:
        logger.error("Ollama embedding request timed out.")
        raise
