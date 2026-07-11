# RFC-004: session_open authorship

Status: draft proposal for ANP/0.2 with a 0.1 clarification. Not
normative. Prototype: `ANP_DRAFT=1 npm run mock-host` accepts
`open_signature`.

## Problem

Section 4 says vendor agents MUST sign every event they submit, and the
published example log shows event 1 (`session_open`, actor
`vendor_agent`) carrying a vendor authorship signature. But the section
6.2 request body is `{ target, envelope }` with no signature field, and
the `session_open` payload (protocol, agent id, name, fingerprint,
envelope) is assembled by the host. The vendor never sees the exact
payload before it is appended, so it cannot produce
`ANP/0.1\nsession_open\n<payload_hash>`.

Conforming implementations already diverge: the example log has a signed
session_open, while the reference production host records `signer` with
a null `signature` (which event.schema.json permits). Verifiers that
require vendor signatures fail every real session at seq 1; verifiers
that accept nulls leave the opening mandate declaration, the vendor's
most consequential statement, cryptographically unattributed.

## Proposed change for 0.2

Option (a), recommended: the section 6.2 body gains an optional
`open_signature`, an Ed25519 signature by the vendor's key over:

```
ANP/0.2\nsession_open_envelope\n<sha256_hex of canonical JSON of the envelope>
```

The host stores it inside the `session_open` payload as
`payload.open_signature`. Because it sits in the payload, it is covered
by `payload_hash` and the chain, and verifiers can check the vendor
signed exactly the envelope that opened the session, while the event's
own authorship signature remains the host's (which did assemble the
record).

Alternatives considered: (b) split the host-assembled `session_open`
from a vendor-signed `envelope` event, making events 1 and 2 symmetric
declarations; (c) bless null-signature host-constructed events and fix
the example log. (a) preserves "signatures prove who authored each
payload" with the smallest wire change.

## Clarification for 0.1 (no bytes change)

State in section 4 that a null `signature` with a declared `signer` is
recorded-but-unproven attribution and does not fail verification, while
a `signature` with no declared `signer` fails because it cannot be
checked against any key. This matches event.schema.json and the
reference verifier's behavior.
