# RFC-003: /.well-known/anp.json, key publication and discovery

Status: draft proposal for ANP/0.2. Not part of ANP/0.1; nothing here is
normative. Prototype: `ANP_DRAFT=1 npm run mock-host` serves the
endpoint.

## Problem

Two related gaps:

1. Section 4 says buyer hosts SHOULD sign their events "with a published
   platform key," but the spec never says where the key is published.
   In practice verifiers take the key from the log's own `keys` block,
   which the host wrote. A malicious host can self-attest any key, so
   buyer-side signatures currently prove authorship only against the
   host's own claim.
2. There is no capability discovery. A client cannot learn which
   protocol versions a host speaks before failing closed, which will
   matter the day 0.2 exists.

## Proposed change

Hosts MUST serve, at the origin of their API base URL:

```
GET /.well-known/anp.json
```

```json
{
  "protocol_versions": ["ANP/0.1"],
  "api_base": "/api/agent/v1",
  "platform_keys": [
    {
      "public_key": "<base64url raw Ed25519>",
      "fingerprint": "<sha256 hex>",
      "roles": ["events", "approval"],
      "valid_from": "2026-07-01T00:00:00Z",
      "valid_to": null
    }
  ]
}
```

Rules:

- Served with `access-control-allow-origin: *` and cacheable; the file is
  public by design.
- Verifiers SHOULD cross-check every buyer-side `signer` fingerprint in a
  log against the host's published keys, fetched independently of the
  log. A mismatch downgrades those signatures to unverified attribution.
- Keys carry validity windows so rotation (RFC-007) does not invalidate
  historical logs: a signature verifies against the key that was valid at
  the event's `at` time.
- `protocol_versions` lets a 0.2 client discover 0.1-only hosts before
  sending anything, replacing a failed-closed error with a clean
  capability answer.

## Compatibility

Purely additive for hosts (a new endpoint), so it could ship as a 0.1.x
SHOULD; the verifier cross-check behavior belongs to 0.2. TLS remains
the root of trust for the fetch itself, which matches the protocol's
existing HTTPS assumption.
