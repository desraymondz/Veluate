"""Swappable LLM provider via LangChain.

Set LLM_PROVIDER in .env to switch models without changing agent code:
  - anthropic  -> Claude (langchain-anthropic)
  - kimi       -> Moonshot Kimi (OpenAI-compatible API)
  - openai     -> GPT models (langchain-openai)
"""

import os
from functools import lru_cache

from langchain_core.language_models import BaseChatModel

SUPPORTED_PROVIDERS = ("anthropic", "kimi", "openai")

DEFAULT_MODELS = {
    "anthropic": "claude-sonnet-4-20250514",
    "kimi": "moonshot-v1-32k",
    "openai": "gpt-4o-mini",
}


def _resolve_model(provider: str) -> str:
    return os.getenv("LLM_MODEL") or DEFAULT_MODELS[provider]


@lru_cache
def get_llm() -> BaseChatModel:
    provider = os.getenv("LLM_PROVIDER", "anthropic").lower()

    if provider not in SUPPORTED_PROVIDERS:
        raise ValueError(
            f"Unknown LLM_PROVIDER '{provider}'. "
            f"Choose one of: {', '.join(SUPPORTED_PROVIDERS)}"
        )

    model = _resolve_model(provider)

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(model=model, temperature=0)

    if provider == "kimi":
        from langchain_openai import ChatOpenAI

        api_key = os.getenv("MOONSHOT_API_KEY")
        if not api_key:
            raise ValueError("MOONSHOT_API_KEY is required when LLM_PROVIDER=kimi")

        return ChatOpenAI(
            model=model,
            temperature=0,
            api_key=api_key,
            base_url="https://api.moonshot.cn/v1",
        )

    from langchain_openai import ChatOpenAI

    return ChatOpenAI(model=model, temperature=0)
