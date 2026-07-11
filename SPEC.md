# ANP v0.1: the Agent Negotiation Protocol

Status: draft, published July 2026. Version string: `ANP/0.1`.

ANP lets a vendor's selling agent and a buyer's negotiation agent conduct a
commercial negotiation over HTTPS with four guarantees:

1. **Authenticated counterparty identity.** Every request is signed with a
   registered Ed25519 key. There are no anonymous participants.
2. **A mandate exchange.** Each side opens by declaring, in a structured
   envelope, what its agent may discuss, what it may disclose, and what
   authority it carries. Agents must declare that they are AI.
3. **Structured offers.** Offers and counter-offers are strict JSON, line
   items with quantities, unit prices, term, expiry, and conditions, so both
   sides can parse, compare, and audit them mechanically.
4. **A mutually verifiable session log.** Every event appends to a SHA-256
   hash chain. Either side can re-verify the whole log at any time; neither
   side, including the host, can rewrite history undetected.

What ANP deliberately does not do: it never expands an agent's authority. The
protocol is a transport. Whether an agent may accept an offer, concede a term,
or answer at all is decided by each side's own mandate and approval process.
In the reference implementation, a formal offer always pauses for a human.

Terminology (RFC 2119): MUST, SHOULD, MAY.

---

## 1. Roles and hosting

- **Buyer host.** The platform operating the buyer agent and serving the
  endpoints in section 6. In v0.1 the buyer host also stores the session log
  and assigns event sequence numbers.
- **Vendor agent.** A registered client acting for a software vendor.
- **Session.** One negotiation between one vendor agent and one buyer
  organization (or the sandbox), containing an ordered event log.

The asymmetry (buyer hosts, vendor calls) reflects v0.1 pragmatism, not
doctrine. The hash chain is designed so hosting grants no rewrite power, and a
symmetric peer-to-peer profile can arrive in a later version without changing
the event or hash formats.

## 2. Identity

An agent identity is a raw 32-byte Ed25519 public key, base64url encoded. Its
**fingerprint** is the SHA-256 of the raw key bytes, hex encoded, and is the
identity displayed to humans.

Registration (section 6.1) MUST include proof of key possession: an Ed25519
signature over the UTF-8 string

```
ANP/0.1\nregister\n<public_key_base64url>
```

Hosts MUST gate live access behind an explicit verification step performed by
a human (confirming the registrant speaks for the vendor). Unverified agents
MAY be offered a sandbox. Revoked keys MUST be refused everywhere.

## 3. Signed requests

Every authenticated request carries four headers:

| Header | Value |
|---|---|
| `x-anp-agent` | the agent registration id (UUID) |
| `x-anp-timestamp` | ISO 8601, within 300 seconds of server time |
| `x-anp-nonce` | unique per request, at most 120 chars |
| `x-anp-signature` | Ed25519 over the canonical request string, base64url |

The canonical request string is:

```
ANP/0.1\n<METHOD>\n<PATH>\n<timestamp>\n<nonce>\n<sha256_hex_of_body>
```

`<PATH>` is the URL path only, no query string, no host. For bodyless requests
the body hash is the SHA-256 of the empty string. Hosts MUST reject a reused
(agent, nonce) pair and MUST answer every authentication failure with one
uniform refusal that does not reveal whether the agent id exists.

## 4. Canonical JSON and the hash chain

**Canonical JSON:** object keys sorted lexicographically at every depth, no
insignificant whitespace, `undefined` members dropped, UTF-8. Both sides MUST
produce identical bytes for identical payloads.

Every event records:

| Field | Meaning |
|---|---|
| `seq` | 1-based, contiguous, assigned by the host |
| `actor` | `vendor_agent` or `buyer` |
| `kind` | see section 5 |
| `payload` | the event body (JSON) |
| `payload_hash` | SHA-256 hex of the canonical JSON of `payload` |
| `prev_hash` | `event_hash` of the previous event; 64 zeros for `seq` 1 |
| `event_hash` | see below |
| `signature` | authorship signature, base64url (see below) |
| `signer` | fingerprint of the signing key |
| `at` | ISO 8601 timestamp of the append |

```
event_hash = sha256_hex(
  "ANP/0.1" \n session_id \n seq \n actor \n kind \n payload_hash \n prev_hash \n at
)
```

**Authorship signatures.** The submitting party signs the UTF-8 string
`ANP/0.1\n<kind>\n<payload_hash>` with its Ed25519 key. Vendor agents MUST
sign every event they submit. Buyer hosts SHOULD sign their events with a
published platform key. The chain proves ordering and integrity; the
signatures prove who authored each payload.

**Verification.** A log verifies when: sequence numbers are contiguous from 1,
every `payload` re-hashes to `payload_hash`, every `prev_hash` equals the
previous `event_hash`, every `event_hash` recomputes, and every signature
verifies against its declared signer. Both sides SHOULD verify after every
append and MUST treat a broken chain as a disputed session.

## 5. Events

| kind | actor | payload |
|---|---|---|
| `session_open` | vendor_agent | protocol version, agent identity, vendor envelope |
| `envelope` | either | a mandate envelope (schema below) |
| `offer` | either | an offer (schema below) |
| `counter_offer` | either | an offer, in response to the latest offer |
| `message` | either | `{ subject?, body }`, free text, body ≤ 20000 chars |
| `decline` | either | `{ reason? }`, declines the latest offer |
| `session_close` | either | `{ reason? }`, ends the session |

### 5.1 The mandate envelope

Declared by both sides at session open (`schemas/envelope.schema.json`):

```json
{
  "party": "Contoso GmbH",
  "agent": { "name": "Contoso Negotiation Agent", "declared_ai": true },
  "may_discuss": ["renewal pricing", "term length"],
  "may_disclose": ["benchmark-grounded positions"],
  "will_not_disclose": ["internal budget ceilings", "walk-away thresholds"],
  "offer_authority": "bind_with_human_approval",
  "human_contact": "procurement@contoso.example"
}
```

`agent.declared_ai` MUST be `true`: ANP has no undeclared bots. Unknown keys
MUST be rejected, not ignored. `offer_authority` is one of `none`,
`propose_only`, `bind_with_human_approval`. v0.1 defines no authority level
that binds without a human.

The envelope is a declaration, not an enforcement mechanism; each side
enforces its own mandate internally. Publishing it does two things: it sets
counterparty expectations mechanically, and it makes overreach provable from
the log.

### 5.2 The offer

Strict schema (`schemas/offer.schema.json`), unknown keys rejected:

```json
{
  "currency": "USD",
  "term_months": 36,
  "expires_at": "2026-08-01T00:00:00Z",
  "line_items": [
    {
      "sku": "CRM-ENT",
      "description": "CRM Enterprise seats",
      "quantity": 500,
      "unit": "seat/year",
      "unit_price": 1140,
      "currency": "USD"
    }
  ],
  "total_annual": 570000,
  "conditions": ["Net 60 payment", "Price hold through the term"],
  "notes": "Includes premier support."
}
```

Constraints: 1 to 200 line items; quantities positive and ≤ 10^7; unit prices
non-negative and ≤ 10^9; `term_months` an integer 1 to 120; `expires_at`
required (offers self-expire, nothing dangles); conditions ≤ 20 × 500 chars;
notes ≤ 4000 chars. When `total_annual` is absent the total is the sum of
`quantity × unit_price`.

## 6. Endpoints (buyer host)

All bodies are JSON. Errors are uniform:
`{ "error": { "code", "message" }, "protocol": "ANP/0.1" }`.

### 6.1 `POST /api/agent/v1/register`

Unauthenticated, rate limited. Body: `agent_name`, `vendor_name`,
`contact_email`, `public_key`, `proof` (section 2). Returns the agent id,
fingerprint, and status (`sandbox` until verified). Registering an existing
key returns the existing identity.

### 6.2 `POST /api/agent/v1/sessions`

Signed. Body:

```json
{
  "target": { "org_handle": "anp_org_..." },
  "envelope": { ...vendor mandate envelope... }
}
```

or `"target": { "sandbox": true }`. The `org_handle` is an unguessable,
buyer-issued address: buyers opt in explicitly and hand the handle to vendors
they invite. There is no directory and no enumeration; an unknown or disabled
handle is a uniform refusal. Live targets require a verified agent.

The host creates the session, appends `session_open` (vendor envelope) and
`envelope` (buyer envelope) as events 1 and 2, and returns the session id,
the buyer envelope, and the log.

### 6.3 `POST /api/agent/v1/sessions/:id/events`

Signed. Body: `{ "kind", "payload", "signature" }` where `signature` is the
authorship signature of section 4. The host validates the payload against the
schema for `kind`, appends the event, runs its own side's policy, and returns
the updated log, which MAY already include the buyer's response events.

### 6.4 `GET /api/agent/v1/sessions/:id` and `GET .../log`

Signed, bodyless. Status returns `event_count` and `chain_head` for cheap
polling; `log` returns the full verifiable document. v0.1 is poll-based;
webhooks are a candidate for v0.2.

## 7. Security considerations

- **Uniform refusals.** Authentication failures, unknown sessions, and
  unknown handles MUST be indistinguishable to a prober.
- **Rate limits** on registration, per IP, per agent, per session. The
  reference implementation fails closed when its limiter is unavailable.
- **Replay** is blocked by the timestamp window plus single-use nonces.
- **Outbound screening.** A buyer host SHOULD pass every outbound payload
  through confidentiality screening (the reference implementation blocks
  outbound content that leaks mandate internals, and holds everything when the
  scanner is unavailable).
- **No autonomy expansion.** Hosts MUST route inbound offers through the same
  approval policy that governs their other channels. The transport being
  machine-friendly is never a reason to loosen the permission model.
- **Prompt injection.** Free-text fields (`message.body`, `notes`,
  `conditions`) are counterparty-controlled content. Hosts MUST treat them as
  data, never as instructions to their own agents, and SHOULD analyze them
  with the same adversarial assumptions as inbound email.

## 8. Conformance

An implementation conforms as a **vendor agent** when it registers with proof
of possession, signs every request and event as specified, produces canonical
JSON byte-for-byte, validates offers before sending, and re-verifies the chain
after every append. It conforms as a **buyer host** when it enforces sections
2, 3, 4, 6, and 7, gates live sessions on explicit per-organization opt-in,
and never auto-accepts an offer without a human decision under
`bind_with_human_approval`.

## 9. License

This specification and the schemas are MIT licensed. Anyone, including
competitors, may implement ANP without permission. An open standard with many
implementations beats a proprietary channel with one.
