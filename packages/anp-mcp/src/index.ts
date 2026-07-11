#!/usr/bin/env node
/**
 * An MCP server that gives any MCP-capable agent (Claude, or anything else
 * speaking the Model Context Protocol) the vendor agent side of ANP/0.1 as
 * tools: generate an identity, register with a buyer host, open sessions,
 * send offers and messages, and verify session logs.
 *
 * The Ed25519 private key lives only in this process's memory; it is
 * generated non-extractable and is gone when the process exits. Set
 * ANP_BUYER_HOST to change the default host; every tool also accepts an
 * explicit `host` argument.
 *
 * The server never widens the agent's authority: it is a transport. Whether
 * an offer should be sent or accepted stays with the calling agent's own
 * mandate and its human approval process, exactly as the spec requires.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  type AgentIdentity,
  fetchLog,
  generateIdentity,
  openSession,
  register,
  sendEvent,
  verifyLog,
} from "@anp/client";

const DEFAULT_HOST = process.env.ANP_BUYER_HOST ?? "";

let identity: AgentIdentity | null = null;

function requireIdentity(): AgentIdentity {
  if (!identity) {
    throw new Error(
      "no identity yet: call anp_generate_identity first (keys live only in this process)",
    );
  }
  return identity;
}

function resolveHost(host: string | undefined): string {
  const resolved = host ?? DEFAULT_HOST;
  if (!resolved) {
    throw new Error(
      "no buyer host: pass `host` or set the ANP_BUYER_HOST environment variable",
    );
  }
  return resolved;
}

function ok(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function fail(err: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: err instanceof Error ? err.message : String(err),
      },
    ],
  };
}

const hostArg = z
  .string()
  .url()
  .optional()
  .describe("Buyer host base URL; defaults to ANP_BUYER_HOST");

const server = new McpServer({ name: "anp", version: "0.1.0" });

server.registerTool(
  "anp_generate_identity",
  {
    description:
      "Generate a fresh Ed25519 agent identity in this process. Returns the base64url public key and its SHA-256 fingerprint. The private key never leaves the process and cannot be exported.",
    inputSchema: {},
  },
  async () => {
    try {
      identity = await generateIdentity();
      return ok({
        public_key: identity.publicKey,
        fingerprint: identity.fingerprint,
        note: "private key held in memory only; registration is required before signed requests",
      });
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "anp_register",
  {
    description:
      "Register the current identity with a buyer host (ANP/0.1 section 6.1), signing the proof of key possession. Returns the host-assigned agent id and status (sandbox until a human verifies the vendor).",
    inputSchema: {
      host: hostArg,
      agent_name: z.string().min(3).max(120),
      vendor_name: z.string().min(1),
      contact_email: z.string().email(),
    },
  },
  async ({ host, agent_name, vendor_name, contact_email }) => {
    try {
      const result = await register(resolveHost(host), requireIdentity(), {
        agent_name,
        vendor_name,
        contact_email,
      });
      return ok({
        agent_id: result.agentId,
        fingerprint: result.fingerprint,
        status: result.status,
      });
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "anp_open_session",
  {
    description:
      "Open a negotiation session (section 6.2) against the sandbox or a buyer-issued org handle, declaring the vendor mandate envelope. The envelope must set agent.declared_ai to true; ANP has no undeclared bots. Returns the session id, the buyer's envelope, and the initial verified log.",
    inputSchema: {
      host: hostArg,
      envelope: z
        .record(z.unknown())
        .describe(
          "Vendor mandate envelope per envelope.schema.json: party, agent {name, declared_ai: true}, may_discuss, may_disclose, offer_authority, …",
        ),
      org_handle: z
        .string()
        .optional()
        .describe("Buyer-issued org handle for a live session; omit for the sandbox"),
    },
  },
  async ({ host, envelope, org_handle }) => {
    try {
      const opened = await openSession(
        resolveHost(host),
        requireIdentity(),
        envelope,
        org_handle ? { org_handle } : { sandbox: true },
      );
      const verdict = await verifyLog(opened.log, {
        keys: { [requireIdentity().fingerprint]: requireIdentity().publicKey },
      });
      return ok({
        session_id: opened.sessionId,
        buyer_envelope: opened.buyerEnvelope,
        chain: { verified: verdict.ok, events: verdict.eventCount },
        log: opened.log,
      });
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "anp_send_offer",
  {
    description:
      "Send a structured offer or counter offer (section 5.2) on an open session, signed with the authorship signature. The returned log may already include the buyer's response events and is re-verified before being returned.",
    inputSchema: {
      host: hostArg,
      session_id: z.string(),
      offer: z
        .record(z.unknown())
        .describe(
          "Offer per offer.schema.json: currency, term_months, expires_at, line_items[], conditions?, notes?",
        ),
      counter: z
        .boolean()
        .optional()
        .describe("Send as kind counter_offer instead of offer"),
    },
  },
  async ({ host, session_id, offer, counter }) => {
    try {
      const log = await sendEvent(
        resolveHost(host),
        requireIdentity(),
        session_id,
        counter ? "counter_offer" : "offer",
        offer,
      );
      const verdict = await verifyLog(log, {
        keys: { [requireIdentity().fingerprint]: requireIdentity().publicKey },
      });
      return ok({ chain: { verified: verdict.ok, events: verdict.eventCount }, log });
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "anp_send_message",
  {
    description:
      "Send a free text message event on an open session (body ≤ 20000 chars), signed with the authorship signature.",
    inputSchema: {
      host: hostArg,
      session_id: z.string(),
      body: z.string().min(1).max(20000),
      subject: z.string().optional(),
    },
  },
  async ({ host, session_id, body, subject }) => {
    try {
      const log = await sendEvent(
        resolveHost(host),
        requireIdentity(),
        session_id,
        "message",
        subject ? { subject, body } : { body },
      );
      const verdict = await verifyLog(log, {
        keys: { [requireIdentity().fingerprint]: requireIdentity().publicKey },
      });
      return ok({ chain: { verified: verdict.ok, events: verdict.eventCount }, log });
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "anp_fetch_log",
  {
    description:
      "Fetch a session's full log (section 6.4) with a signed request and verify the whole chain locally: hashes, linkage, and every Ed25519 authorship signature.",
    inputSchema: {
      host: hostArg,
      session_id: z.string(),
    },
  },
  async ({ host, session_id }) => {
    try {
      const log = await fetchLog(resolveHost(host), requireIdentity(), session_id);
      const verdict = await verifyLog(log, {
        keys: { [requireIdentity().fingerprint]: requireIdentity().publicKey },
      });
      return ok({ verification: verdict, log });
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "anp_verify_log",
  {
    description:
      "Verify any ANP/0.1 session log document offline (section 4). No identity or network needed; returns the per-event, per-check verdict. A broken chain means a disputed session.",
    inputSchema: {
      log: z.record(z.unknown()).describe("A session log document as returned by GET .../log"),
    },
  },
  async ({ log }) => {
    try {
      return ok(await verifyLog(log as never));
    } catch (err) {
      return fail(err);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
