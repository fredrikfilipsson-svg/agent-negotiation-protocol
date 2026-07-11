# RFC-002: Human approval attestation

Status: draft proposal for ANP/0.2. Not part of ANP/0.1; nothing here is
normative. Prototype: `ANP_DRAFT=1 npm run mock-host`.

## Problem

`bind_with_human_approval` is the protocol's central safety property, and
section 8 makes "never auto-accepts an offer without a human decision" a
conformance requirement for buyer hosts. But nothing on the wire
evidences the human decision: the requirement is unobservable, so a
conformance harness cannot test it and an auditor reading the log cannot
distinguish a human-approved acceptance from an automated one.

## Proposed change

The `accept` payload (RFC-001) gains a required member when the accepting
side declared `offer_authority: "bind_with_human_approval"`:

```json
{
  "in_response_to": "<event_hash>",
  "approval": {
    "approved_by": "procurement@fabrikam.example",
    "at": "2026-08-01T12:00:00Z",
    "method": "human",
    "signature": "<base64url Ed25519 over the approval string>"
  }
}
```

The approval string is:

```
ANP/0.2\napproval\n<in_response_to>\n<approved_by>\n<at>
```

signed by an approval key the accepting platform publishes (RFC-003's
`/.well-known/anp.json` lists approval keys alongside platform keys; an
organization MAY use one key for both roles).

Rules:

- Under `bind_with_human_approval`, an `accept` without a verifiable
  `approval` member is invalid and MUST be refused by the receiving side.
- `method` is `"human"` in 0.2; the enum exists so a future version can
  express other governance arrangements explicitly rather than silently.
- Verifiers check the approval signature in addition to the event's
  authorship signature; the attestation lives inside the payload, so it
  is covered by `payload_hash` and the chain.

## What this does and does not prove

The attestation proves the accepting platform's approval key signed off
on this specific acceptance at a stated time, attributed to a stated
person or role. It does not prove a human physically clicked a button;
that remains the platform's internal responsibility, exactly as key
custody already is. What changes is that the claim becomes explicit,
signed, and auditable, and a platform that automates it is now provably
violating its own attestation rather than an unverifiable prose rule.

## Compatibility

Requires RFC-001. New signed string format, so 0.2 material.
