"""Session log verification per ANP/0.1 section 4.

Mirrors the reference TypeScript verifier, including its treatment of
unsigned attributions: a null signature with a declared signer is
recorded-but-unproven attribution and passes with a note, while a
signature with no declared signer fails because it cannot be checked
against any key.
"""

from __future__ import annotations

from typing import Any

from .canonical import canonical_json
from .signing import (
    PROTOCOL_VERSION,
    authorship_string,
    fingerprint_of,
    sha256_hex,
    verify_signature,
)

GENESIS_PREV_HASH = "0" * 64


def compute_payload_hash(payload: Any) -> str:
    """SHA-256 hex of the payload's canonical JSON bytes."""
    return sha256_hex(canonical_json(payload))


def compute_event_hash(session_id: str, event: dict[str, Any]) -> str:
    """The section 4 event hash preimage, hashed."""
    preimage = "\n".join(
        [
            PROTOCOL_VERSION,
            session_id,
            str(event["seq"]),
            event["actor"],
            event["kind"],
            event["payload_hash"],
            event["prev_hash"],
            event["at"],
        ]
    )
    return sha256_hex(preimage)


def _collect_keys(
    log: dict[str, Any],
    extra_keys: dict[str, str] | None,
    problems: list[str],
) -> dict[str, str]:
    keys: dict[str, str] = {}
    for party, entry in (log.get("keys") or {}).items():
        if not isinstance(entry, dict):
            continue
        public_key = entry.get("public_key")
        if not public_key:
            continue
        try:
            actual = fingerprint_of(public_key)
        except Exception:
            problems.append(f"keys.{party}: public_key is not valid base64url")
            continue
        declared = entry.get("fingerprint")
        if declared and declared != actual:
            problems.append(
                f"keys.{party}: declared fingerprint does not match the published key"
            )
            continue
        keys[actual] = public_key
    keys.update(extra_keys or {})
    return keys


def verify_log(
    log: dict[str, Any], extra_keys: dict[str, str] | None = None
) -> dict[str, Any]:
    """Verify a whole session log. Returns a dict with ``ok``,
    ``event_count``, ``verified_count``, per event ``events`` (each with
    its ``checks``), and log level ``problems``."""
    problems: list[str] = []
    key_map = _collect_keys(log, extra_keys, problems)
    results: list[dict[str, Any]] = []

    if log.get("protocol") != PROTOCOL_VERSION:
        problems.append(
            f"log declares protocol {log.get('protocol')!r}, expected {PROTOCOL_VERSION}"
        )

    prev_event_hash = GENESIS_PREV_HASH
    for index, event in enumerate(log.get("events") or []):
        checks: list[dict[str, Any]] = []

        expected_seq = index + 1
        checks.append(
            {"name": "seq", "ok": event["seq"] == expected_seq}
            if event["seq"] == expected_seq
            else {
                "name": "seq",
                "ok": False,
                "detail": f"sequence numbers must be contiguous from 1; position {index} carries seq {event['seq']}",
            }
        )

        try:
            payload_hash = compute_payload_hash(event["payload"])
            checks.append(
                {"name": "payload_hash", "ok": payload_hash == event["payload_hash"]}
                if payload_hash == event["payload_hash"]
                else {
                    "name": "payload_hash",
                    "ok": False,
                    "detail": "the payload does not hash to the declared payload_hash",
                }
            )
        except TypeError as err:
            checks.append(
                {"name": "payload_hash", "ok": False, "detail": str(err)}
            )

        checks.append(
            {"name": "prev_hash", "ok": event["prev_hash"] == prev_event_hash}
            if event["prev_hash"] == prev_event_hash
            else {
                "name": "prev_hash",
                "ok": False,
                "detail": "prev_hash does not equal the previous event's event_hash",
            }
        )

        recomputed = compute_event_hash(log["session"]["id"], event)
        checks.append(
            {"name": "event_hash", "ok": recomputed == event["event_hash"]}
            if recomputed == event["event_hash"]
            else {
                "name": "event_hash",
                "ok": False,
                "detail": "event_hash does not recompute from the declared fields",
            }
        )

        signature = event.get("signature")
        signer = event.get("signer")
        if signature and signer:
            public_key = key_map.get(signer)
            if public_key is None:
                checks.append(
                    {
                        "name": "signature",
                        "ok": False,
                        "detail": "no public key known for the declared signer",
                    }
                )
            else:
                valid = verify_signature(
                    public_key,
                    signature,
                    authorship_string(event["kind"], event["payload_hash"]),
                )
                checks.append(
                    {"name": "signature", "ok": valid}
                    if valid
                    else {
                        "name": "signature",
                        "ok": False,
                        "detail": "the authorship signature does not verify against the declared signer's key",
                    }
                )
        elif signature and not signer:
            checks.append(
                {
                    "name": "signature",
                    "ok": False,
                    "detail": "a signature is present but no signer is declared",
                }
            )
        elif signer and not signature:
            checks.append(
                {
                    "name": "signature",
                    "ok": True,
                    "detail": "authorship attributed but unsigned; the attribution is recorded, not proven",
                }
            )
        else:
            checks.append(
                {
                    "name": "signature",
                    "ok": True,
                    "detail": "no authorship signature present",
                }
            )

        prev_event_hash = event["event_hash"]
        results.append(
            {
                "seq": event["seq"],
                "ok": all(c["ok"] for c in checks),
                "checks": checks,
            }
        )

    verified = sum(1 for r in results if r["ok"])
    return {
        "ok": not problems and verified == len(results),
        "event_count": len(results),
        "verified_count": verified,
        "events": results,
        "problems": problems,
    }
