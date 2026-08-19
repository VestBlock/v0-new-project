from __future__ import annotations

import os

from app.models import ResearchRequest
from app.research import ResearchRunner
from app.settings import Settings


def main() -> None:
    os.environ.setdefault("SCRAPLING_WORKER_TOKEN", "local-smoke-only-token")
    os.environ.setdefault("SCRAPLING_ALLOWED_DOMAINS", "example.com")
    settings = Settings.from_env()
    error = settings.startup_error()
    if error:
        raise RuntimeError(error)
    evidence = ResearchRunner(settings).collect(
        ResearchRequest(
            source_url="https://example.com/",
            strategy_lane="local_intelligence",
            extraction_template="local_intelligence",
            purpose="market_research",
            idempotency_key="vestblock-gate2-local-smoke-0001",
        )
    )
    if evidence.source_domain != "example.com" or not evidence.text_excerpt:
        raise RuntimeError("The worker did not produce public research evidence.")
    print(f"local smoke passed: {evidence.source_domain} ({evidence.robots_decision})")


if __name__ == "__main__":
    main()
