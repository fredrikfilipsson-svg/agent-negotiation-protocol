# ANP, the Agent Negotiation Protocol

An open protocol for buyer and vendor AI agents to negotiate commercial terms
with authenticated identity, declared mandates, structured offers, and a
session log both sides can verify but neither side can rewrite.

- **Spec:** [SPEC.md](./SPEC.md) (v0.1, draft)
- **Schemas:** [schemas/](./schemas) (JSON Schema for envelopes, offers, and events)
- **Example:** [examples/session-log.example.json](./examples/session-log.example.json)
- **License:** [MIT](./LICENSE). Implement it, fork it, ship it. Attribution is appreciated, not required.

## Why this exists

Vendor selling agents are coming. When they arrive, the question is whether
they negotiate through an unaudited side channel or through a protocol that
gives both legal departments the same verifiable record. ANP is the second
option: every message is signed, every offer is structured, and the session
log is a hash chain that either party can re-verify independently.

Three properties are non negotiable in any conforming implementation:

1. **Declared identity.** Every agent declares itself as an AI and signs every
   request with a registered Ed25519 key. Anonymous counterparties get a clean
   refusal.
2. **Bounded mandates.** Both sides open the session by declaring what they
   may discuss and disclose. The transport never widens an agent's authority:
   what a human approved is what the agent may do.
3. **Mutual verifiability.** Both sides append to one hash chain. Tampering by
   either party, including the host, is detectable by the other.

## Reference implementation

VendorBenchmark ships the reference implementation:

- Vendor-facing endpoints under `/api/agent/v1` (register, open sessions,
  append events, pull the log)
- A free integration sandbox against a fictional buyer, Fabrikam Industries,
  with deterministic scripted responses
- Buyer-side rendering of the session ledger inside the negotiation record

Vendor onboarding starts at `https://app.vendorbenchmark.com/agent-protocol/vendors`.

## Open-source home

The public repository is
<https://github.com/fredrikfilipsson-svg/agent-negotiation-protocol>: issues,
pull requests, and the list of implementations live there. When the spec or
schemas change here, push the same change to that repo and to the published
mirror below, in the same change set.

## Published artifacts

Everything in this directory is also published at stable public URLs (mirror
under `public/agent-protocol/`; keep the two in sync when the spec changes):

- Spec: `https://app.vendorbenchmark.com/agent-protocol/spec-v0.1.md`
- Schemas: `https://app.vendorbenchmark.com/agent-protocol/schemas/{offer,envelope,event}.schema.json`
  (these are the schemas' own `$id` URLs, so `$ref` resolution works)
- Example log: `https://app.vendorbenchmark.com/agent-protocol/examples/session-log.example.json`
- License: `https://app.vendorbenchmark.com/agent-protocol/license.txt`

## Versioning

This is v0.1, a draft published to be implemented against and argued with.
Breaking changes bump the version string (`ANP/0.1`) that is baked into every
signature and hash, so mixed-version sessions fail closed rather than subtly.
