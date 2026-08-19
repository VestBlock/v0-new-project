from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.main import create_app
from app.models import ResearchEvidence
from app.research import ResearchRunner
from app.settings import Settings


class FakeRunner(ResearchRunner):
    def collect(self, _request):
        return ResearchEvidence(
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


def test_research_endpoint_requires_a_bearer_token() -> None:
    settings = Settings(
        environment="test",
        worker_token="test-token",
        allowed_domains=frozenset({"example.com"}),
        trusted_hosts=("testserver",),
        user_agent="VestblockResearchTest/0.1",
        request_timeout_seconds=3,
        domain_min_interval_seconds=1,
        max_concurrent_requests=1,
        max_response_characters=1000,
        max_request_bytes=4096,
        idempotency_ttl_seconds=60,
    )
    with TestClient(create_app(settings, FakeRunner(settings))) as client:
        response = client.post(
            "/v1/research",
            json={
                "source_url": "https://example.com/",
                "strategy_lane": "lender_network",
                "extraction_template": "lender_criteria",
                "purpose": "crm_research",
                "idempotency_key": "vestblock-gate2-test-0001",
            },
        )
        assert response.status_code == 401


def test_research_endpoint_returns_research_only_evidence() -> None:
    settings = Settings(
        environment="test",
        worker_token="test-token",
        allowed_domains=frozenset({"example.com"}),
        trusted_hosts=("testserver",),
        user_agent="VestblockResearchTest/0.1",
        request_timeout_seconds=3,
        domain_min_interval_seconds=1,
        max_concurrent_requests=1,
        max_response_characters=1000,
        max_request_bytes=4096,
        idempotency_ttl_seconds=60,
    )
    with TestClient(create_app(settings, FakeRunner(settings))) as client:
        response = client.post(
            "/v1/research",
            headers={"Authorization": "Bearer test-token"},
            json={
                "source_url": "https://example.com/",
                "strategy_lane": "lender_network",
                "extraction_template": "lender_criteria",
                "purpose": "crm_research",
                "idempotency_key": "vestblock-gate2-test-0002",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["evidence"]["source_domain"] == "example.com"
        assert "not eligible for direct outreach" not in body["evidence"]["evidence_summary"].lower()
