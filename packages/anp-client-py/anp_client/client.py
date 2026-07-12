"""HTTP client for the buyer host endpoints of ANP/0.1 section 6.

Standard library only (urllib); the sole third party dependency of the
package is ``cryptography`` for Ed25519.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlsplit

from .canonical import canonical_json
from .signing import (
    EMPTY_BODY_SHA256,
    AgentIdentity,
    authorship_string,
    canonical_request_string,
    random_nonce,
    registration_proof_string,
    sha256_hex,
    sign,
)


class AnpClientError(Exception):
    """Raised for any non-2xx response from a buyer host."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code


def _join(host: str, path: str) -> str:
    return host.rstrip("/") + "/" + path.lstrip("/")


def _request(
    url: str, method: str, headers: dict[str, str], body: str | None
) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        method=method,
        headers=headers,
        data=body.encode("utf-8") if body is not None else None,
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            text = response.read().decode("utf-8")
            status = response.status
    except urllib.error.HTTPError as err:
        text = err.read().decode("utf-8")
        status = err.code
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as err:
        raise AnpClientError(
            status, "invalid_response", f"non-JSON response (HTTP {status})"
        ) from err
    if status >= 400:
        error = parsed.get("error") or {}
        raise AnpClientError(
            status,
            error.get("code", "error"),
            error.get("message", f"the host refused the request (HTTP {status})"),
        )
    return parsed


def signed_headers(
    identity: AgentIdentity, method: str, path: str, body: str | None = None
) -> dict[str, str]:
    """The four signed headers of section 3 for one request."""
    if not identity.agent_id:
        raise ValueError(
            "identity has no agent_id; call register() before signed requests"
        )
    timestamp = (
        datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    )
    nonce = random_nonce()
    body_hash = EMPTY_BODY_SHA256 if body is None else sha256_hex(body)
    signature = sign(
        identity,
        canonical_request_string(method, path, timestamp, nonce, body_hash),
    )
    return {
        "x-anp-agent": identity.agent_id,
        "x-anp-timestamp": timestamp,
        "x-anp-nonce": nonce,
        "x-anp-signature": signature,
    }


def register(
    host: str, identity: AgentIdentity, details: dict[str, str]
) -> dict[str, Any]:
    """Register with proof of key possession (section 6.1). Stores the
    host assigned agent id on the identity and returns the response."""
    body = json.dumps(
        {
            **details,
            "public_key": identity.public_key,
            "proof": sign(identity, registration_proof_string(identity.public_key)),
        }
    )
    parsed = _request(
        _join(host, "api/agent/v1/register"),
        "POST",
        {"content-type": "application/json"},
        body,
    )
    agent_id = parsed.get("agent_id") or (parsed.get("agent") or {}).get("id")
    if not agent_id:
        raise AnpClientError(200, "invalid_response", "no agent id in response")
    identity.agent_id = str(agent_id)
    return parsed


def open_session(
    host: str,
    identity: AgentIdentity,
    envelope: dict[str, Any],
    target: dict[str, Any],
) -> dict[str, Any]:
    """Open a session (section 6.2). Returns the parsed response; the log
    is under ``log`` and the session id under ``session_id``."""
    url = _join(host, "api/agent/v1/sessions")
    path = urlsplit(url).path
    body = json.dumps({"target": target, "envelope": envelope})
    headers = {
        "content-type": "application/json",
        **signed_headers(identity, "POST", path, body),
    }
    return _request(url, "POST", headers, body)


def send_event(
    host: str,
    identity: AgentIdentity,
    session_id: str,
    kind: str,
    payload: Any,
) -> dict[str, Any]:
    """Append an event (section 6.3), signed with the authorship
    signature over the canonical payload hash. Returns the updated log."""
    payload_hash = sha256_hex(canonical_json(payload))
    signature = sign(identity, authorship_string(kind, payload_hash))
    url = _join(host, f"api/agent/v1/sessions/{session_id}/events")
    path = urlsplit(url).path
    body = json.dumps({"kind": kind, "payload": payload, "signature": signature})
    headers = {
        "content-type": "application/json",
        **signed_headers(identity, "POST", path, body),
    }
    parsed = _request(url, "POST", headers, body)
    return parsed.get("log", parsed)


def fetch_log(
    host: str, identity: AgentIdentity, session_id: str
) -> dict[str, Any]:
    """Fetch the full verifiable log (section 6.4). Signed, bodyless."""
    url = _join(host, f"api/agent/v1/sessions/{session_id}/log")
    path = urlsplit(url).path
    parsed = _request(url, "GET", signed_headers(identity, "GET", path), None)
    return parsed.get("log", parsed)
