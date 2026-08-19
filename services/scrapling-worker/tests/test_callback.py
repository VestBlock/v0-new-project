from __future__ import annotations

import hmac
from datetime import UTC, datetime
from hashlib import sha256

from app.callback import build_callback_payload
from app.models import ResearchEvidence


def test_callback_payload_has_a_stable_signed_body_shape() -> None:
    evidence = ResearchEvidence(
        source_url="https://example.com/",
        source_domain="example.com",
        retrieved_at=datetime.now(UTC),
        robots_decision="robots_allowed",
        terms_policy="approved",
        extraction_method="test",
        title="Example Domain",
        headings=[],
        text_excerpt="Example evidence",
        content_risk_signals=[],
        evidence_summary="Research only.",
    )
    payload, raw_body, event_id = build_callback_payload(
        "00000000-0000-4000-8000-000000000001",
        evidence,
        event_id="vestblock-worker-event-0001",
    )
    assert payload["event_id"] == event_id
    assert payload["job_id"] == "00000000-0000-4000-8000-000000000001"
    assert '"source_domain":"example.com"' in raw_body
    signature = hmac.new(b"callback-test-secret", f"123.{raw_body}".encode("utf-8"), sha256).hexdigest()
    assert len(signature) == 64
