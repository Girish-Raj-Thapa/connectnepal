import logging

import requests
from django.conf import settings

logger = logging.getLogger('chatbot')


def generate_response(prompt: str, model: str | None = None) -> str:
    """
    Generate a text response from Ollama.

    Args:
        prompt: The full prompt string to send to the model.
        model: Model name. Defaults to settings.OLLAMA_CHAT_MODEL.

    Returns:
        The generated response text.

    Raises:
        ConnectionError: If Ollama is not reachable.
        RuntimeError: If the response format is unexpected.
    """
    if model is None:
        model = settings.OLLAMA_CHAT_MODEL

    url = f"{settings.OLLAMA_BASE_URL}/api/generate"

    try:
        response = requests.post(
            url,
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "num_predict": 512,
                },
            },
            timeout=settings.OLLAMA_CHAT_TIMEOUT,
        )
        response.raise_for_status()

    except requests.ConnectionError:
        logger.error("Cannot connect to Ollama at %s", settings.OLLAMA_BASE_URL)
        raise ConnectionError(
            f"Cannot connect to Ollama at {settings.OLLAMA_BASE_URL}. "
            "Make sure Ollama is running with 'ollama serve'."
        )
    except requests.Timeout:
        logger.error("Ollama request timed out after %ds", settings.OLLAMA_CHAT_TIMEOUT)
        raise RuntimeError(
            "Ollama request timed out. The model may be loading or the prompt may be too long."
        )
    except requests.HTTPError as e:
        logger.error("Ollama HTTP error: %s", str(e))
        raise RuntimeError(f"Ollama returned an error: {e.response.status_code}")

    data = response.json()
    text = data.get("response", "")

    if not text:
        logger.warning("Ollama returned an empty response.")
        raise RuntimeError("Ollama returned an empty response.")

    logger.debug(
        "Ollama response generated: model=%s, prompt_length=%d, response_length=%d",
        model, len(prompt), len(text),
    )

    return text.strip()
