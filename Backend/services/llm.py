"""
Phase 9 (part) - LLM API abstraction.

One small client, many providers. We deliberately do NOT train or host a model:
the agent uses an existing chat-completions API when one is configured, and
falls back to deterministic, template-based narration when it is not. The demo
therefore works with **zero API keys** and gets richer with one.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Dict, Optional

from config import settings

try:  # requests is a core requirement, but never hard-fail on import
    import requests
except Exception:  # pragma: no cover
    requests = None  # type: ignore[assignment]

DEFAULT_MODELS: Dict[str, str] = {
    "openai": "gpt-4o-mini",
    "groq": "llama-3.1-8b-instant",
    "ollama": "llama3.1",
    "custom": "gpt-4o-mini",
}

DEFAULT_BASE_URLS: Dict[str, str] = {
    "openai": "https://api.openai.com/v1",
    "groq": "https://api.groq.com/openai/v1",
    "ollama": "http://localhost:11434/v1",
    "custom": "",
}


@dataclass
class LLMResult:
    """Outcome of a chat request."""

    text: str = ""
    used_llm: bool = False
    provider: str = "template"
    model: str = ""
    error: Optional[str] = None

    @property
    def ok(self) -> bool:
        return self.used_llm and not self.error


class LLMClient:
    """Minimal OpenAI-compatible chat client."""

    def __init__(
        self,
        provider: str | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> None:
        self.provider = (provider or settings.llm_provider or "none").lower()
        self.api_key = api_key if api_key is not None else settings.llm_api_key
        self.base_url = (base_url if base_url is not None else settings.llm_base_url) or DEFAULT_BASE_URLS.get(
            self.provider, ""
        )
        self.model = (model if model is not None else settings.llm_model) or DEFAULT_MODELS.get(
            self.provider, ""
        )
        self.temperature = settings.llm_temperature if temperature is None else temperature
        self.max_tokens = settings.llm_max_tokens if max_tokens is None else max_tokens
        self.timeout = settings.llm_timeout_seconds if timeout is None else timeout

    # ------------------------------------------------------------------ #
    # capability
    # ------------------------------------------------------------------ #
    @property
    def available(self) -> bool:
        """True when this client can plausibly make a call."""
        if requests is None:
            return False
        if self.provider in ("", "none", "off", "disabled"):
            return False
        if not self.base_url or not self.model:
            return False
        if self.provider == "ollama":
            return True  # local server, no key required
        return bool(self.api_key)

    @property
    def info(self) -> Dict[str, Any]:
        return {
            "provider": self.provider if self.available else "template",
            "model": self.model if self.available else "deterministic-template",
            "uses_external_llm": self.available,
            "note": (
                "External LLM configured."
                if self.available
                else "No LLM configured - using deterministic template narration. "
                "Set LLM_PROVIDER / LLM_API_KEY in backend/.env to enable it."
            ),
        }

    # ------------------------------------------------------------------ #
    # chat
    # ------------------------------------------------------------------ #
    def chat(
        self,
        system: str,
        user: str,
        *,
        json_mode: bool = False,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> LLMResult:
        """Send one chat-completion request. Never raises - errors are returned."""
        if not self.available:
            return LLMResult(error="llm_not_configured")

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": self.temperature if temperature is None else temperature,
            "max_tokens": self.max_tokens if max_tokens is None else max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        url = f"{self.base_url.rstrip('/')}/chat/completions"
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            text = data["choices"][0]["message"]["content"] or ""
            return LLMResult(
                text=text.strip(),
                used_llm=True,
                provider=self.provider,
                model=self.model,
            )
        except Exception as error:  # noqa: BLE001 - degrade gracefully, never 500
            return LLMResult(
                text="",
                used_llm=False,
                provider=self.provider,
                model=self.model,
                error=f"{type(error).__name__}: {error}",
            )

    def chat_json(
        self, system: str, user: str, *, retries: int = 1
    ) -> tuple[Optional[Any], LLMResult]:
        """Chat and parse a JSON object out of the reply (None if unavailable)."""
        result = self.chat(system + "\n\nRespond with a single valid JSON object and nothing else.", user, json_mode=True)

        for attempt in range(retries + 1):
            if not result.ok:
                return None, result
            parsed = extract_json(result.text)
            if parsed is not None:
                return parsed, result
            if attempt < retries:
                result = self.chat(
                    system,
                    user + "\n\nReturn ONLY raw JSON. No markdown fences, no commentary.",
                    json_mode=True,
                )
        return None, result


_CODE_FENCE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def extract_json(text: str) -> Optional[Any]:
    """Best-effort JSON extraction from an LLM reply."""
    if not text:
        return None

    candidates = []
    fenced = _CODE_FENCE.search(text)
    if fenced:
        candidates.append(fenced.group(1))
    candidates.append(text.strip())

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            start = candidate.find("{")
            end = candidate.rfind("}")
            if start != -1 and end > start:
                try:
                    return json.loads(candidate[start : end + 1])
                except json.JSONDecodeError:
                    continue
    return None


llm_client = LLMClient()
