from __future__ import annotations

import hmac
import json
import time
import uuid
from datetime import UTC, datetime
from hashlib import sha256
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.models import ResearchEvidence
from app.settings import Settings


class CallbackDeliveryError(RuntimeError):
    """The worker may safely retry the same research job after callback failure."""


def _signature(secret: str, timestamp: int, raw_body: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), f"{timestamp}.{raw_body}".encode("utf-8"), sha256).hexdigest()
    return f"v1={digest}"


def build_callback_payload(job_id: str, evidence: ResearchEvidence, event_id: str | None = None) -> tuple[dict[str, object], str, str]:
    payload: dict[str, object] = {
        "event_id": event_id or str(uuid.uuid4()),
        "job_id": job_id,
        "delivered_at": datetime.now(UTC).isoformat(),
        "evidence": evidence.model_dump(mode="json"),
    }
    raw_body = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    return payload, raw_body, str(payload["event_id"])


def deliver_research_callback(settings: Settings, job_id: str, evidence: ResearchEvidence) -> str:
    if not settings.callback_url or not settings.callback_secret:
        raise CallbackDeliveryError("The research worker received a durable job id without a callback configuration.")

    _payload, raw_body, event_id = build_callback_payload(job_id, evidence)
    timestamp = int(time.time())
    request = Request(
        settings.callback_url,
        data=raw_body.encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Vestblock-Timestamp": str(timestamp),
            "X-Vestblock-Signature": _signature(settings.callback_secret, timestamp, raw_body),
            "User-Agent": settings.user_agent,
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=settings.callback_timeout_seconds) as response:  # nosec B310 -- URL is deployment configuration, not request-controlled
            if int(response.status) < 200 or int(response.status) >= 300:
                raise CallbackDeliveryError(f"Vestblock callback returned HTTP {response.status}.")
            response.read(4096)
    except HTTPError as error:
        raise CallbackDeliveryError(f"Vestblock callback returned HTTP {error.code}.") from error
    except URLError as error:
        raise CallbackDeliveryError("Vestblock callback could not be reached.") from error
    return event_id
