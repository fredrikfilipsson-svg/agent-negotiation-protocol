"""Python client for ANP/0.1, the Agent Negotiation Protocol.

The reference TypeScript implementation lives in the same repository;
this package is the independent second implementation, validated against
the published test vectors and example session log at
https://aiaagentnetwork.com/conformance.
"""

from .canonical import canonical_json, canonical_json_bytes
from .chain import (
    GENESIS_PREV_HASH,
    compute_event_hash,
    compute_payload_hash,
    verify_log,
)
from .client import (
    AnpClientError,
    fetch_log,
    open_session,
    register,
    send_event,
    signed_headers,
)
from .signing import (
    EMPTY_BODY_SHA256,
    PROTOCOL_VERSION,
    AgentIdentity,
    authorship_string,
    canonical_request_string,
    fingerprint_of,
    from_base64url,
    generate_identity,
    random_nonce,
    registration_proof_string,
    sha256_hex,
    sign,
    to_base64url,
    verify_signature,
)

__all__ = [
    "AgentIdentity",
    "AnpClientError",
    "EMPTY_BODY_SHA256",
    "GENESIS_PREV_HASH",
    "PROTOCOL_VERSION",
    "authorship_string",
    "canonical_json",
    "canonical_json_bytes",
    "canonical_request_string",
    "compute_event_hash",
    "compute_payload_hash",
    "fetch_log",
    "fingerprint_of",
    "from_base64url",
    "generate_identity",
    "open_session",
    "random_nonce",
    "register",
    "registration_proof_string",
    "send_event",
    "sha256_hex",
    "sign",
    "signed_headers",
    "to_base64url",
    "verify_log",
    "verify_signature",
]
