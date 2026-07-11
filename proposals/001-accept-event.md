# RFC-001: The accept event

Status: draft proposal for ANP/0.2. Not part of ANP/0.1; nothing here is
normative. Prototype: `ANP_DRAFT=1 npm run mock-host`.

## Problem

ANP/0.1 defines seven event kinds: session_open, envelope, offer,
counter_offer, message, decline, session_close. A negotiation can be
declined but never consummated on the wire. The one fact the session log
exists to prove, who agreed to what, currently happens outside the
protocol, so the log of a successful negotiation ends ambiguously: a
session_close after an offer does not distinguish agreement from
abandonment.

## Proposed change

A new event kind, `accept`, submittable by either actor, with a strict
payload schema (unknown keys rejected):

```json
{
  "in_response_to": "<event_hash of the accepted offer or counter_offer event>",
  "note": "optional free text, <= 4000 chars"
}
```

Rules:

- `in_response_to` MUST equal the `event_hash` of a prior `offer` or
  `counter_offer` event in the same session. Referencing the event hash,
  not the payload hash, binds the acceptance to one specific event (its
  seq, actor, and timestamp), so two identical offers at different points
  in the negotiation cannot be confused.
- The referenced offer MUST NOT be expired (`expires_at`) at the time the
  host appends the accept.
- The accepting party signs the event with the standard authorship
  signature. Under `bind_with_human_approval`, the accept MUST carry the
  approval attestation of RFC-002.
- After an accept, the only valid subsequent kinds are `message` and
  `session_close`. Session status becomes `accepted`.

## Compatibility

A new event kind changes the wire contract, so this is 0.2 material. The
event hashing and chain rules of section 4 apply to `accept` unchanged.

## Security considerations

Acceptance is the highest-value event in the log; requiring a reference
to a specific `event_hash` prevents a host from replaying an acceptance
against a different offer, because the reference is inside the signed,
hashed payload.
