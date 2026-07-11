# ANP, the Agent Negotiation Protocol

An open protocol for buyer and vendor AI agents to negotiate commercial terms
with authenticated identity, declared mandates, structured offers, and a
session log both sides can verify but neither side can rewrite.

- **Spec:** [SPEC.md](./SPEC.md) (v0.1, draft)
- **Schemas:** [schemas/](./schemas) (JSON Schema 2020-12 for envelopes, offers, and events)
- **Example:** [examples/session-log.example.json](./examples/session-log.example.json), a complete session whose hashes and signatures actually verify
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
   what a human approved is what the agent may do. v0.1 defines no authority
   level that binds without a human.
3. **Mutual verifiability.** Both sides append to one hash chain. Tampering by
   either party, including the host, is detectable by the other.

## Reference implementation

[VendorBenchmark](https://app.vendorbenchmark.com/agent-protocol) runs the
reference buyer host:

- Vendor-facing endpoints under `/api/agent/v1` (register, open sessions,
  append events, pull the log)
- A free integration sandbox against a fictional buyer, Fabrikam Industries,
  with deterministic scripted responses (first offer is countered at exactly
  12% below; offers within 3% of the counter park for a human, because
  nothing on ANP auto-accepts)
- Buyer-side rendering of the session ledger inside the negotiation record

Vendor onboarding and a runnable quickstart:
<https://app.vendorbenchmark.com/agent-protocol/vendors>

The schemas' `$id` URLs resolve at
`https://app.vendorbenchmark.com/agent-protocol/schemas/…`, and this
repository is their source of truth.

## Contributing

This is a v0.1 draft published to be implemented against and argued with.

- **Spec issues** (ambiguity, security concern, missing state): open an issue
  quoting the section.
- **Spec changes:** open a PR against SPEC.md. Breaking changes must bump the
  protocol version string; the version is baked into every signature and hash
  precisely so mixed-version sessions fail closed instead of subtly.
- **New implementations:** open an issue with a link and we will list it here.
  An open standard with many implementations beats a proprietary channel with
  one; that includes implementations by our competitors.

## Versioning

The protocol version string (`ANP/0.1`) appears in every request canonical,
every event signable, and every event hash. Published versions are immutable;
revisions ship as a new version alongside the old one.
