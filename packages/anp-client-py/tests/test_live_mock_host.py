"""End to end against the repository's mock buyer host: the Python
client registers, opens a sandbox session, negotiates, and verifies the
chain produced by the Node implementation. Skipped when node is not on
the PATH."""

import os
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest

from anp_client import (
    generate_identity,
    open_session,
    register,
    send_event,
    verify_log,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
HOST = "http://127.0.0.1:18789"

pytestmark = pytest.mark.skipif(
    shutil.which("node") is None, reason="node not available"
)

ENVELOPE = {
    "party": "Python Client Test Vendor",
    "agent": {"name": "Python Client Test Agent", "declared_ai": True},
    "may_discuss": ["renewal pricing"],
    "may_disclose": ["list pricing"],
    "offer_authority": "propose_only",
}

OFFER = {
    "currency": "USD",
    "term_months": 12,
    "expires_at": "2027-01-01T00:00:00Z",
    "line_items": [
        {
            "description": "Python client seats",
            "quantity": 25,
            "unit": "seat/year",
            "unit_price": 1200,
            "currency": "USD",
        }
    ],
}


@pytest.fixture(scope="module")
def mock_host():
    process = subprocess.Popen(
        ["node", str(REPO_ROOT / "scripts" / "mock-buyer-host.mjs")],
        env={**os.environ, "PORT": "18789"},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    deadline = time.time() + 15
    while True:
        try:
            # An empty registration draws a 400, proving the host is up
            # and speaking the protocol.
            request = urllib.request.Request(
                f"{HOST}/api/agent/v1/register",
                method="POST",
                headers={"content-type": "application/json"},
                data=b"{}",
            )
            urllib.request.urlopen(request, timeout=2)
            break
        except urllib.error.HTTPError:
            break
        except Exception:
            if time.time() > deadline:
                process.kill()
                raise RuntimeError("mock host did not start")
            time.sleep(0.2)
    yield HOST
    process.kill()


def test_full_negotiation_round_trip(mock_host):
    identity = generate_identity()
    registration = register(
        mock_host,
        identity,
        {
            "agent_name": "Python Client Test Agent",
            "vendor_name": "Python Client Test Vendor",
            "contact_email": "python@example.com",
        },
    )
    assert registration["status"] == "sandbox"
    assert registration["fingerprint"] == identity.fingerprint

    opened = open_session(mock_host, identity, ENVELOPE, {"sandbox": True})
    session_id = opened["session_id"]
    assert [e["kind"] for e in opened["log"]["events"]] == [
        "session_open",
        "envelope",
    ]

    log = send_event(mock_host, identity, session_id, "offer", OFFER)
    kinds = [e["kind"] for e in log["events"]]
    assert kinds == ["session_open", "envelope", "offer", "counter_offer"]

    # The chain built by the Node host verifies in Python, including the
    # Ed25519 signatures: cross-implementation interop end to end.
    verdict = verify_log(
        log, extra_keys={identity.fingerprint: identity.public_key}
    )
    assert verdict["ok"] is True
    assert verdict["verified_count"] == 4
