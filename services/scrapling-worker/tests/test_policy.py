from __future__ import annotations

import socket
from unittest.mock import patch

import pytest

from app.policy import PolicyViolation, approve_public_url
from app.settings import Settings


@pytest.fixture
def settings() -> Settings:
    return Settings(
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


@patch("app.policy.socket.getaddrinfo")
def test_allows_an_allowlisted_public_domain(resolve, settings: Settings) -> None:
    resolve.return_value = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]
    target = approve_public_url("https://www.example.com/about", settings)
    assert target.hostname == "www.example.com"


@patch("app.policy.socket.getaddrinfo")
def test_rejects_unapproved_domains_before_fetch(resolve, settings: Settings) -> None:
    with pytest.raises(PolicyViolation, match="allowlist"):
        approve_public_url("https://unapproved.example.net/", settings)
    resolve.assert_not_called()


@patch("app.policy.socket.getaddrinfo")
def test_rejects_private_network_resolution(resolve, settings: Settings) -> None:
    resolve.return_value = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443))]
    with pytest.raises(PolicyViolation, match="Private"):
        approve_public_url("https://example.com/", settings)


def test_rejects_nonstandard_http_ports(settings: Settings) -> None:
    with pytest.raises(PolicyViolation, match="standard public HTTP"):
        approve_public_url("https://example.com:8443/", settings)
