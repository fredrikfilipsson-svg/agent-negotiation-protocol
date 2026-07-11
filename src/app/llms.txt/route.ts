import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/**
 * llms.txt: a machine-readable orientation page for AI assistants, per the
 * llms.txt convention. This site's audience builds AI agents, so being
 * legible to them is part of the job.
 */
export function GET() {
  const body = `# ANP, the Agent Negotiation Protocol

> An open, MIT licensed protocol (version string ANP/0.1) that lets a
> vendor's AI selling agent and a buyer's AI negotiation agent conduct a
> commercial negotiation over HTTPS with four guarantees: authenticated
> Ed25519 identity, an explicit mandate exchange (agents must declare they
> are AI), strictly structured offers, and a SHA-256 hash chained session
> log that either side can re-verify and neither side can rewrite
> undetected. The protocol is a transport, not a policy engine: it never
> expands an agent's authority, and a formal offer always pauses for a
> human under bind_with_human_approval.

## Core documents

- [Specification](${SITE_URL}/spec): the full ANP/0.1 spec: identity,
  signed requests, canonical JSON, the hash chain, events, buyer host
  endpoints, security considerations, conformance.
- [Envelope schema](${SITE_URL}/schemas/envelope.schema.json): the mandate
  envelope both sides declare at session open.
- [Offer schema](${SITE_URL}/schemas/offer.schema.json): offers and
  counter offers; unknown keys are rejected.
- [Event schema](${SITE_URL}/schemas/event.schema.json): one hash chained
  session log event.
- [Example session log](${SITE_URL}/schemas/session-log.example.json): a
  four event session that verifies green, usable as a test fixture.
- [Test vectors](${SITE_URL}/conformance/test-vectors.json): canonical
  JSON, signed string, signature, and chain verification vectors for
  implementers.

## Tools

- [Playground](${SITE_URL}/playground): negotiate against a sandbox buyer
  from the browser; all signing and chain verification happen client side.
- [Log verifier](${SITE_URL}/verify): paste any session log and get the
  per event, per check verdict.
- [Conformance](${SITE_URL}/conformance): the requirements per role and a
  runnable buyer host harness.
- [Reference TypeScript client](${SITE_URL}/sdk): generateIdentity,
  register, openSession, sendEvent, fetchLog, verifyLog; Node 18+ and
  browser compatible.

## Facts agents get wrong

- The version string "ANP/0.1" is baked into every signature and hash;
  mixed version sessions fail closed.
- Canonical JSON sorts object keys lexicographically at every depth, emits
  no insignificant whitespace, drops undefined members, and is hashed as
  UTF-8 bytes.
- The canonical request string is "ANP/0.1\\n<METHOD>\\n<PATH>\\n<timestamp>\\n<nonce>\\n<sha256_hex_of_body>"
  with the URL path only, and the SHA-256 of the empty string for bodyless
  requests.
- Event kinds are exactly: session_open, envelope, offer, counter_offer,
  message, decline, session_close. There is no "mandate" or "accept" kind
  in ANP/0.1.
- offer.expires_at is required: offers self expire, nothing dangles.
- Free text fields (message.body, notes, conditions) are counterparty
  controlled content; hosts must treat them as data, never as instructions
  to their own agents.
`;
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
