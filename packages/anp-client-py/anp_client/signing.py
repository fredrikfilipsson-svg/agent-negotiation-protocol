"""Ed25519 identity and the signed strings of ANP/0.1 sections 2 to 4."""

from __future__ import annotations

import base64
import hashlib
import secrets
from dataclasses import dataclass, field

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

PROTOCOL_VERSION = "ANP/0.1"

EMPTY_BODY_SHA256 = (
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
)
"""SHA-256 hex of the empty string, the body hash for bodyless requests."""


def to_base64url(data: bytes) -> str:
    """Base64url without padding, per RFC 4648 section 5."""
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def from_base64url(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def sha256_hex(data: str | bytes) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def random_nonce() -> str:
    """A fresh request nonce, well under the 120 character limit."""
    return to_base64url(secrets.token_bytes(18))


@dataclass
class AgentIdentity:
    """A raw 32-byte Ed25519 keypair. Only ``public_key`` ever leaves the
    process; ``agent_id`` is assigned by the host at registration."""

    private_key: Ed25519PrivateKey
    public_key: str
    fingerprint: str
    agent_id: str | None = field(default=None)


def generate_identity() -> AgentIdentity:
    """Generate a fresh Ed25519 identity."""
    private_key = Ed25519PrivateKey.generate()
    raw = private_key.public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw
    )
    return AgentIdentity(
        private_key=private_key,
        public_key=to_base64url(raw),
        fingerprint=sha256_hex(raw),
    )


def fingerprint_of(public_key_base64url: str) -> str:
    """Fingerprint of a base64url raw public key: SHA-256 hex of the bytes."""
    return sha256_hex(from_base64url(public_key_base64url))


def sign(identity: AgentIdentity, message: str | bytes) -> str:
    """Sign a UTF-8 string or raw bytes; returns the base64url signature."""
    if isinstance(message, str):
        message = message.encode("utf-8")
    return to_base64url(identity.private_key.sign(message))


def verify_signature(
    public_key_base64url: str, signature_base64url: str, message: str | bytes
) -> bool:
    """Verify a base64url Ed25519 signature. Never raises; returns False."""
    if isinstance(message, str):
        message = message.encode("utf-8")
    try:
        key = Ed25519PublicKey.from_public_bytes(
            from_base64url(public_key_base64url)
        )
        key.verify(from_base64url(signature_base64url), message)
        return True
    except (InvalidSignature, ValueError):
        return False


def registration_proof_string(public_key_base64url: str) -> str:
    """Section 2: ``ANP/0.1\\nregister\\n<public_key_base64url>``."""
    return f"{PROTOCOL_VERSION}\nregister\n{public_key_base64url}"


def canonical_request_string(
    method: str, path: str, timestamp: str, nonce: str, body_sha256_hex: str
) -> str:
    """Section 3 canonical request string; ``path`` is the URL path only."""
    return f"{PROTOCOL_VERSION}\n{method}\n{path}\n{timestamp}\n{nonce}\n{body_sha256_hex}"


def authorship_string(kind: str, payload_hash: str) -> str:
    """Section 4: ``ANP/0.1\\n<kind>\\n<payload_hash>``."""
    return f"{PROTOCOL_VERSION}\n{kind}\n{payload_hash}"
