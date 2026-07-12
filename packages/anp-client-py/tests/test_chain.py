import copy

from anp_client import generate_identity, sign, verify_log, verify_signature
from anp_client.signing import registration_proof_string


def test_example_log_verifies_green(example_log):
    verdict = verify_log(example_log)
    assert verdict["problems"] == []
    assert verdict["event_count"] == 4
    assert verdict["verified_count"] == 4
    assert verdict["ok"] is True


def test_tampered_payload_fails_only_payload_hash(example_log):
    log = copy.deepcopy(example_log)
    log["events"][2]["payload"]["line_items"][0]["unit_price"] = 1
    verdict = verify_log(log)
    assert verdict["ok"] is False
    event = next(e for e in verdict["events"] if e["seq"] == 3)
    failed = {c["name"] for c in event["checks"] if not c["ok"]}
    # The signature covers the declared hash, so it still verifies: the
    # log proves the original payload was signed, not the tampered one.
    assert failed == {"payload_hash"}


def test_unsigned_attribution_passes_with_note(example_log):
    log = copy.deepcopy(example_log)
    log["events"][0]["signature"] = None
    verdict = verify_log(log)
    event = next(e for e in verdict["events"] if e["seq"] == 1)
    signature_check = next(
        c for c in event["checks"] if c["name"] == "signature"
    )
    assert signature_check["ok"] is True
    assert "not proven" in signature_check["detail"]
    assert verdict["ok"] is True


def test_identity_roundtrip():
    identity = generate_identity()
    assert len(identity.fingerprint) == 64
    message = registration_proof_string(identity.public_key)
    signature = sign(identity, message)
    assert verify_signature(identity.public_key, signature, message)
    assert not verify_signature(identity.public_key, signature, message + "x")
