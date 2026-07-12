# RFC-008: Event notification webhooks

Status: draft proposal for ANP/0.2, already named a candidate in the
0.1 spec (section 6.4). Not normative. Prototype:
`ANP_DRAFT=1 npm run mock-host` sends signed hints to a registered
`webhook_url`.

## Problem

0.1 is poll-based: a vendor agent learns of buyer responses by polling
`GET .../sessions/:id` for `event_count` and `chain_head`. Polling adds
latency to every negotiation round and load to every host, and it gets
worse exactly as adoption grows: an agent negotiating with twelve
buyers polls twelve hosts.

## Proposed change

Registration (6.1) and a new management endpoint accept an optional
`webhook_url` (HTTPS only). When a session the agent participates in
appends events, the host POSTs a hint:

```json
{
  "protocol": "ANP/0.2",
  "session_id": "…",
  "event_count": 7,
  "chain_head": "<event_hash of the latest event>",
  "at": "2026-08-01T12:00:00Z"
}
```

with headers `x-anp-platform-signature` (Ed25519 by the host's platform
key over `ANP/0.2\nwebhook\n<session_id>\n<event_count>\n<chain_head>\n<at>`)
and `x-anp-timestamp`.

Rules that keep the trust model intact:

- The webhook is a hint, not a transport. The recipient MUST fetch the
  log through the signed section 6.4 endpoints and re-verify the chain;
  webhook payloads never carry event content, so a forged or replayed
  hint can at worst cause a wasted poll.
- Recipients verify the platform signature (key from RFC-003's
  well-known document) and drop hints older than the timestamp window.
- Delivery is at-most-once with no retries required of hosts; polling
  remains the correctness backstop. Hosts SHOULD retry transient
  failures with backoff but MUST NOT block session progress on webhook
  delivery.
- Hosts MUST disable a webhook URL after sustained failure and expose
  its state to the agent, preventing dead-letter hammering.

## Compatibility

Purely additive endpoint-side; hint-only design means no change to the
event or hash formats. 0.2 because the signed webhook string is a new
wire format.
