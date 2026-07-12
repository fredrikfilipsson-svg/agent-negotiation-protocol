"""Cross-implementation checks: every published vector produced by the
TypeScript reference must reproduce byte for byte in Python. This is the
test that makes ANP a multi-implementation protocol rather than one
codebase with a spec attached."""

from anp_client import (
    authorship_string,
    canonical_json,
    canonical_request_string,
    compute_event_hash,
    registration_proof_string,
    sha256_hex,
    verify_log,
    verify_signature,
)


def test_canonical_json_vectors(vectors):
    for case in vectors["canonical_json"]:
        got = canonical_json(case["input"])
        assert got == case["canonical"], case["name"]
        assert sha256_hex(got) == case["sha256_hex"], case["name"]


def test_registration_proof_string(vectors):
    fixture = vectors["signed_strings"]["registration_proof"]
    assert registration_proof_string(fixture["public_key"]) == fixture["string"]


def test_canonical_request_string(vectors):
    fixture = vectors["signed_strings"]["canonical_request"]
    assert sha256_hex(fixture["body"]) == fixture["body_sha256_hex"]
    assert (
        canonical_request_string(
            fixture["method"],
            fixture["path"],
            fixture["timestamp"],
            fixture["nonce"],
            fixture["body_sha256_hex"],
        )
        == fixture["string"]
    )


def test_empty_body_hash(vectors):
    fixture = vectors["signed_strings"]["bodyless_request"]
    assert sha256_hex("") == fixture["empty_body_sha256_hex"]


def test_authorship_string(vectors):
    fixture = vectors["signed_strings"]["authorship"]
    assert (
        authorship_string(fixture["kind"], fixture["payload_hash"])
        == fixture["string"]
    )


def test_signature_vectors(vectors):
    for case in vectors["signatures"]:
        valid = verify_signature(
            case["public_key"], case["signature"], case["message"]
        )
        assert valid == (case["expect"] == "valid")


def test_event_hash_vector(vectors):
    fixture = vectors["event_hash"]
    assert (
        compute_event_hash(fixture["session_id"], fixture["event"])
        == fixture["expected_event_hash"]
    )


def test_chain_verification_vectors(vectors):
    for case in vectors["chain_verification"]:
        verdict = verify_log(case["log"])
        assert verdict["ok"] == case["expect"]["ok"], case["name"]
        for failing in case["expect"]["failing"]:
            event = next(
                e for e in verdict["events"] if e["seq"] == failing["seq"]
            )
            failed_names = {
                c["name"] for c in event["checks"] if not c["ok"]
            }
            for check in failing["checks"]:
                assert check in failed_names, f"{case['name']}: {check}"
