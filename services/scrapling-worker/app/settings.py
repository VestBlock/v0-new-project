from __future__ import annotations

import os
from dataclasses import dataclass


def _positive_int(name: str, fallback: int) -> int:
    try:
        value = int(os.getenv(name, str(fallback)))
    except ValueError:
        return fallback
    return value if value > 0 else fallback


def _csv_env(name: str) -> frozenset[str]:
    return frozenset(
        value.strip().lower().rstrip(".")
        for value in os.getenv(name, "").split(",")
        if value.strip()
    )


@dataclass(frozen=True)
class Settings:
    environment: str
    worker_token: str
    allowed_domains: frozenset[str]
    trusted_hosts: tuple[str, ...]
    user_agent: str
    request_timeout_seconds: int
    domain_min_interval_seconds: int
    max_concurrent_requests: int
    max_response_characters: int
    max_request_bytes: int
    idempotency_ttl_seconds: int
    callback_url: str = ""
    callback_secret: str = ""
    callback_timeout_seconds: int = 10

    @classmethod
    def from_env(cls) -> "Settings":
        trusted_hosts = tuple(_csv_env("SCRAPLING_TRUSTED_HOSTS")) or ("localhost", "127.0.0.1", "testserver")
        return cls(
            environment=os.getenv("SCRAPLING_ENV", "development").strip().lower(),
            worker_token=os.getenv("SCRAPLING_WORKER_TOKEN", "").strip(),
            allowed_domains=_csv_env("SCRAPLING_ALLOWED_DOMAINS"),
            trusted_hosts=trusted_hosts,
            user_agent=os.getenv("SCRAPLING_USER_AGENT", "VestblockResearch/0.1 (+https://www.vestblock.io)").strip(),
            request_timeout_seconds=_positive_int("SCRAPLING_REQUEST_TIMEOUT_SECONDS", 12),
            domain_min_interval_seconds=_positive_int("SCRAPLING_DOMAIN_MIN_INTERVAL_SECONDS", 3),
            max_concurrent_requests=_positive_int("SCRAPLING_MAX_CONCURRENT_REQUESTS", 2),
            max_response_characters=_positive_int("SCRAPLING_MAX_RESPONSE_CHARACTERS", 6000),
            max_request_bytes=_positive_int("SCRAPLING_MAX_REQUEST_BYTES", 16_384),
            idempotency_ttl_seconds=_positive_int("SCRAPLING_IDEMPOTENCY_TTL_SECONDS", 900),
            callback_url=os.getenv("RESEARCH_WORKER_CALLBACK_URL", "").strip(),
            callback_secret=os.getenv("RESEARCH_WORKER_CALLBACK_SECRET", "").strip(),
            callback_timeout_seconds=_positive_int("RESEARCH_WORKER_CALLBACK_TIMEOUT_SECONDS", 10),
        )

    def startup_error(self) -> str | None:
        if not self.worker_token:
            return "SCRAPLING_WORKER_TOKEN must be configured."
        if not self.allowed_domains:
            return "SCRAPLING_ALLOWED_DOMAINS must contain at least one approved public domain."
        if bool(self.callback_url) != bool(self.callback_secret):
            return "RESEARCH_WORKER_CALLBACK_URL and RESEARCH_WORKER_CALLBACK_SECRET must be configured together."
        if self.environment in {"production", "prod"} and not self.callback_url:
            return "Production research workers require a signed Vestblock callback configuration."
        if self.callback_url and not self.callback_url.startswith("https://") and self.environment in {"production", "prod"}:
            return "Production research callbacks must use HTTPS."
        return None
