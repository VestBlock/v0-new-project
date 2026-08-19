from __future__ import annotations

import re
import threading
import time
from collections import defaultdict, deque
from datetime import UTC, datetime
from hashlib import sha256
from urllib.parse import urlunparse
from urllib.robotparser import RobotFileParser

from scrapling.fetchers import Fetcher

from app.models import ResearchEvidence, ResearchRequest
from app.policy import ApprovedUrl, PolicyViolation, approve_public_url
from app.settings import Settings

_INJECTION_PATTERNS = {
    "instruction_override": re.compile(r"\b(ignore|disregard)\b.{0,80}\b(previous|system|instructions?)\b", re.IGNORECASE),
    "role_impersonation": re.compile(r"\b(system message|developer message|you are chatgpt|assistant instructions)\b", re.IGNORECASE),
    "credential_request": re.compile(r"\b(api key|password|access token|secret key)\b", re.IGNORECASE),
}


def _clean_text(value: object, maximum: int) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:maximum]


def _response_text(response: object) -> str:
    value = getattr(response, "text", None)
    if isinstance(value, str):
        return value
    body = getattr(response, "body", b"")
    if isinstance(body, bytes):
        return body.decode("utf-8", errors="replace")
    return str(body or "")


def _robots_url(target: ApprovedUrl) -> str:
    return urlunparse((target.scheme, target.hostname, "/robots.txt", "", "", ""))


def _robots_decision(target: ApprovedUrl, settings: Settings) -> str:
    robots_url = _robots_url(target)
    try:
        response = Fetcher.get(
            robots_url,
            follow_redirects=False,
            timeout=settings.request_timeout_seconds,
            # Scrapling treats this as its total attempt count; one means one request and no retry loop.
            retries=1,
            stealthy_headers=False,
            headers={"User-Agent": settings.user_agent},
        )
    except Exception as error:
        raise PolicyViolation("robots.txt could not be checked, so this source is blocked.") from error

    status = int(getattr(response, "status", 0) or 0)
    if status == 404:
        return "robots_not_found_allowed"
    if status != 200:
        raise PolicyViolation("robots.txt did not permit an automated policy decision for this source.")

    text = _response_text(response)
    parser = RobotFileParser()
    parser.set_url(robots_url)
    parser.parse(text.splitlines())
    if not parser.can_fetch(settings.user_agent, target.source_url):
        raise PolicyViolation("robots.txt disallows this source path for the Vestblock research worker.")
    return "robots_allowed"


def _extract_page(response: object, maximum: int) -> tuple[str | None, list[str], str]:
    css = getattr(response, "css")
    title = _clean_text(css("title::text").get(), 240) or None
    headings = []
    for value in css("h1::text, h2::text, h3::text").getall():
        normalized = _clean_text(value, 180)
        if normalized and normalized not in headings:
            headings.append(normalized)
        if len(headings) >= 12:
            break
    text_values = css("body ::text").getall()
    text = _clean_text(" ".join(str(value) for value in text_values), maximum)
    if not text:
        text = _clean_text(_response_text(response), maximum)
    return title, headings, text


def _content_risk_signals(text: str) -> list[str]:
    return [name for name, pattern in _INJECTION_PATTERNS.items() if pattern.search(text)]


class ResearchRunner:
    """Small, process-local controls; durable queues and callbacks begin in Gate 3."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._domain_requests: dict[str, deque[float]] = defaultdict(deque)
        self._cache: dict[str, tuple[float, str, ResearchEvidence]] = {}
        self._lock = threading.Lock()
        self._semaphore = threading.BoundedSemaphore(settings.max_concurrent_requests)

    def _cache_key(self, request: ResearchRequest) -> str:
        return request.idempotency_key

    def _request_fingerprint(self, request: ResearchRequest) -> str:
        payload = "|".join(
            [
                request.source_url,
                request.strategy_lane,
                request.extraction_template.value,
                request.purpose.value,
                request.terms_policy,
            ]
        )
        return sha256(payload.encode("utf-8")).hexdigest()

    def _get_cached(self, key: str, fingerprint: str) -> ResearchEvidence | None:
        with self._lock:
            cached = self._cache.get(key)
            if not cached or cached[0] <= time.monotonic():
                self._cache.pop(key, None)
                return None
            if cached[1] != fingerprint:
                raise PolicyViolation("The idempotency key was already used for a different research request.")
            return cached[2].model_copy(update={"cache_hit": True})

    def _put_cached(self, key: str, fingerprint: str, evidence: ResearchEvidence) -> None:
        with self._lock:
            self._cache[key] = (time.monotonic() + self.settings.idempotency_ttl_seconds, fingerprint, evidence)

    def _check_rate_limit(self, domain: str) -> None:
        now = time.monotonic()
        with self._lock:
            recent = self._domain_requests[domain]
            while recent and recent[0] <= now - self.settings.domain_min_interval_seconds:
                recent.popleft()
            if recent:
                raise PolicyViolation("This source domain is cooling down; retry later.")
            recent.append(now)

    def collect(self, request: ResearchRequest) -> ResearchEvidence:
        cache_key = self._cache_key(request)
        request_fingerprint = self._request_fingerprint(request)
        cached = self._get_cached(cache_key, request_fingerprint)
        if cached:
            return cached

        target = approve_public_url(request.source_url, self.settings)
        self._check_rate_limit(target.hostname)
        if not self._semaphore.acquire(timeout=1):
            raise PolicyViolation("The research worker is at its safe concurrency limit; retry later.")
        try:
            robots_decision = _robots_decision(target, self.settings)
            response = Fetcher.get(
                target.source_url,
                follow_redirects=False,
                timeout=self.settings.request_timeout_seconds,
                retries=1,
                stealthy_headers=False,
                headers={"User-Agent": self.settings.user_agent},
            )
            status = int(getattr(response, "status", 0) or 0)
            if status < 200 or status >= 300:
                raise PolicyViolation(f"The approved source returned HTTP {status}; no content was retained.")
            title, headings, text_excerpt = _extract_page(response, self.settings.max_response_characters)
            content_risk_signals = _content_risk_signals(text_excerpt)
            evidence = ResearchEvidence(
                source_url=target.source_url,
                source_domain=target.hostname,
                retrieved_at=datetime.now(UTC),
                robots_decision=robots_decision,
                terms_policy=request.terms_policy,
                extraction_method="scrapling_fetcher_static_targeted_text",
                title=title,
                headings=headings,
                text_excerpt=text_excerpt,
                content_risk_signals=content_risk_signals,
                evidence_summary=(
                    f"Public {request.extraction_template.value.replace('_', ' ')} evidence retrieved from "
                    f"{target.hostname}; it is research-only and is not eligible for direct outreach."
                ),
            )
            self._put_cached(cache_key, request_fingerprint, evidence)
            return evidence
        except PolicyViolation:
            raise
        except Exception as error:
            raise PolicyViolation("The approved source could not be retrieved safely.") from error
        finally:
            self._semaphore.release()
