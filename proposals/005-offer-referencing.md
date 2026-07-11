# RFC-005: Explicit offer referencing

Status: draft proposal for ANP/0.2. Not part of ANP/0.1; nothing here is
normative. Prototype: `ANP_DRAFT=1 npm run mock-host` emits and
validates `in_response_to`.

## Problem

Section 5 defines `counter_offer` as "an offer, in response to the
latest offer," and `decline` as declining "the latest offer." "Latest"
is implicit ordering. If both sides submit near-simultaneously, each
party's view of "latest" can differ at composition time even though the
host serializes appends; after the fact, a reader cannot tell which
offer a counter was actually aimed at. For the highest-stakes readers of
the log, both legal departments, that ambiguity is exactly what the
protocol promises to remove.

## Proposed change

`counter_offer` and `decline` payloads gain a required member:

```json
{ "in_response_to": "<event_hash of the offer or counter_offer being answered>" }
```

- The referenced event MUST be an `offer` or `counter_offer` earlier in
  the same session.
- If the referenced event is no longer the latest standing offer when
  the host appends, the host MUST still append the event (the log
  records what actually happened) but MUST mark the session as requiring
  reconciliation in its own policy layer; the counterparty sees the
  mismatch explicitly instead of silently negotiating across each other.
- `accept` (RFC-001) already carries the same member; this RFC makes
  referencing uniform across all offer-answering kinds.

The `event_hash` is used rather than `payload_hash` because identical
payloads can legitimately recur (a re-sent offer after a price hold
expires); the event hash uniquely identifies one appended event.

## Compatibility

`counter_offer` currently validates against offer.schema.json with
`additionalProperties: false`, so the new member is a breaking schema
change: 0.2 material. A 0.2 schema adds `in_response_to` as required for
counter_offer and optional for offer (an opening offer answers nothing).
