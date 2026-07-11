# RFC-009: Symmetric peer-to-peer profile

Status: exploratory draft for ANP/0.2 or later; the 0.1 spec explicitly
reserved room for it (section 1). Not normative.

## Problem

0.1 is asymmetric by pragmatism: the buyer hosts, the vendor calls. The
spec is explicit that hosting grants no rewrite power and that "a
symmetric peer-to-peer profile can arrive in a later version without
changing the event or hash formats." Vendors with their own platforms,
and buyer pairs negotiating vendor-to-vendor, currently cannot use ANP
without one side adopting the buyer-host role wholesale.

## Design sketch

The invariant this profile must preserve: the event format, the
canonical JSON rules, the event_hash preimage, and the authorship
signature format of section 4 do not change. What changes is who
appends.

- **Session host election.** At session open, the parties agree which
  side operates the append-serializing endpoint for this session (the
  "session host"); the other side participates exactly as a 0.1 vendor
  agent does today. Both sides run the same software; the role is per
  session, not per organization. This is the minimal symmetric step: it
  reuses every 0.1 mechanism and merely removes the rule that the buyer
  always hosts.
- **Cross-signed checkpoints.** To further reduce trust in the session
  host, either party MAY append a `checkpoint` event whose payload is
  the current `chain_head` signed by the submitting party. A checkpoint
  is an on-chain receipt: the counterparty has attested to the chain up
  to that point, so any later divergence is provably after the last
  checkpoint. Checkpoints are additive events and change no hash rules.
- **Dual-append (full symmetry)** — both sides append to their own logs
  and exchange events, with seq assignment replaced by a two-party
  ordering rule — is deliberately out of scope for the first profile.
  It reopens ordering, conflict, and merge questions that the
  single-serializer design exists to avoid, for little practical gain
  while sessions are two-party.

## Migration value

Session host election plus checkpoints gives most of the symmetry
benefit (no forced role adoption, reduced host trust) at a small spec
delta. Full dual-append can be a later profile if multi-party sessions
ever justify it.

## Compatibility

New negotiation at session open and one new event kind (`checkpoint`):
0.2 material. Hash and signature formats unchanged, as the 0.1 spec
promised.
