from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlparse

from app.settings import Settings


class PolicyViolation(ValueError):
    """A request failed Vestblock's public-web research policy."""


@dataclass(frozen=True)
class ApprovedUrl:
    source_url: str
    scheme: str
    hostname: str


def _is_allowed_domain(hostname: str, allowed_domains: frozenset[str]) -> bool:
    return any(hostname == domain or hostname.endswith(f".{domain}") for domain in allowed_domains)


def _assert_public_resolution(hostname: str, port: int) -> None:
    try:
        rows = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror as error:
        raise PolicyViolation("The approved source host could not be resolved.") from error

    addresses = {row[4][0] for row in rows}
    if not addresses:
        raise PolicyViolation("The approved source host did not resolve to an address.")
    for address in addresses:
        try:
            parsed = ipaddress.ip_address(address)
        except ValueError as error:
            raise PolicyViolation("The source host resolved to an invalid address.") from error
        if not parsed.is_global:
            raise PolicyViolation("Private, loopback, link-local, and reserved network targets are not permitted.")


def approve_public_url(source_url: str, settings: Settings) -> ApprovedUrl:
    parsed = urlparse(source_url)
    hostname = (parsed.hostname or "").strip().lower().rstrip(".")
    if parsed.scheme not in {"http", "https"}:
        raise PolicyViolation("Only public HTTP(S) source URLs are permitted.")
    if not hostname or parsed.username or parsed.password:
        raise PolicyViolation("Source URLs must use a hostname and may not include credentials.")
    expected_port = 443 if parsed.scheme == "https" else 80
    if parsed.port is not None and parsed.port != expected_port:
        raise PolicyViolation("Only the standard public HTTP(S) ports are permitted.")
    if not _is_allowed_domain(hostname, settings.allowed_domains):
        raise PolicyViolation("The source domain is not on Vestblock's approved research allowlist.")
    _assert_public_resolution(hostname, expected_port)
    return ApprovedUrl(source_url=source_url, scheme=parsed.scheme, hostname=hostname)
