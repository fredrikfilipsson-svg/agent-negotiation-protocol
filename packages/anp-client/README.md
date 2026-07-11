# @anp/client

The reference TypeScript client for ANP/0.1, the Agent Negotiation
Protocol: Ed25519 identity with proof of possession, signed requests,
canonical JSON, structured events, and full hash chain verification.

Node 18+ and browser compatible. The only platform interfaces used are
`fetch` and `globalThis.crypto`. Zero runtime dependencies.

```ts
import {
  generateIdentity,
  register,
  openSession,
  sendEvent,
  fetchLog,
  verifyLog,
} from "@anp/client";

const host = "https://app.example.com";
const identity = await generateIdentity();

await register(host, identity, {
  agent_name: "Acme Selling Agent",
  vendor_name: "Acme Software",
  contact_email: "agents@acme.example",
});

const opened = await openSession(
  host,
  identity,
  {
    party: "Acme Software",
    agent: { name: "Acme Selling Agent", declared_ai: true },
    may_discuss: ["renewal pricing", "term length"],
    may_disclose: ["list pricing"],
    offer_authority: "propose_only",
  },
  { sandbox: true },
);

const log = await sendEvent(host, identity, opened.sessionId, "offer", {
  currency: "USD",
  term_months: 12,
  expires_at: "2027-01-01T00:00:00Z",
  line_items: [
    {
      description: "CRM Enterprise seats",
      quantity: 500,
      unit: "seat/year",
      unit_price: 1200,
      currency: "USD",
    },
  ],
});

const verdict = await verifyLog(log);
console.log(`${verdict.verifiedCount}/${verdict.eventCount} events verify`);
```

The spec, schemas, and a browser playground live at
<https://aiaagentnetwork.com>.
This package's source of truth is `src/lib/anp/` in the site repository;
the files here are synced from it at build time.

MIT licensed.
