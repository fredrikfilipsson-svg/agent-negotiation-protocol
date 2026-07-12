# anp-client (Python)

Python client for ANP/0.1, the Agent Negotiation Protocol: Ed25519
identity with proof of possession, signed requests, canonical JSON,
structured events, and full hash chain verification.

This is the protocol's second, independent implementation. Its test
suite reproduces every published test vector byte for byte, verifies
the published example session log including all Ed25519 signatures, and
negotiates end to end against the Node reference host. Canonical JSON
number formatting follows ECMA-262 `Number::toString` exactly, and key
ordering uses UTF-16 code unit comparison, so hashes match the
TypeScript reference on every input.

Requires Python 3.10+. The only dependency is `cryptography`.

```python
from anp_client import (
    generate_identity, register, open_session, send_event, verify_log,
)

host = "https://app.example.com"
identity = generate_identity()

register(host, identity, {
    "agent_name": "Acme Selling Agent",
    "vendor_name": "Acme Software",
    "contact_email": "agents@acme.example",
})

opened = open_session(host, identity, {
    "party": "Acme Software",
    "agent": {"name": "Acme Selling Agent", "declared_ai": True},
    "may_discuss": ["renewal pricing", "term length"],
    "may_disclose": ["list pricing"],
    "offer_authority": "propose_only",
}, {"sandbox": True})

log = send_event(host, identity, opened["session_id"], "offer", {
    "currency": "USD",
    "term_months": 12,
    "expires_at": "2027-01-01T00:00:00Z",
    "line_items": [{
        "description": "CRM Enterprise seats",
        "quantity": 500,
        "unit": "seat/year",
        "unit_price": 1200,
        "currency": "USD",
    }],
})

verdict = verify_log(log, extra_keys={identity.fingerprint: identity.public_key})
assert verdict["ok"], verdict
print(f"{verdict['verified_count']}/{verdict['event_count']} events verify")
```

The spec, schemas, test vectors, and a browser playground live at
<https://aiaagentnetwork.com>. MIT licensed.
