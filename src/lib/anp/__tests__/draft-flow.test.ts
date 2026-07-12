/**
 * Integration test for the ANP/0.2 draft prototypes (proposals/ RFC-001,
 * 002, 003, 004, 005, 007) against the mock buyer host running with
 * ANP_DRAFT=1. Spawns the host as a child process on a dedicated port.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AgentIdentity } from "../signing";
import {
  authorshipString,
  fingerprintOf,
  generateIdentity,
  sign,
} from "../signing";
import { canonicalJson } from "../canonicalJson";
import { sha256Hex } from "../encoding";
import { verifySignature } from "../signing";
import type { SessionLog } from "../chain";
import { verifyLog } from "../chain";
import {
  fetchLog,
  openSession,
  register,
  sendEvent,
  signedHeaders,
} from "../client";

// High ports to stay clear of dev servers and stray workerd instances.
const HOST = "http://127.0.0.1:18788";
const RECEIVER_PORT = 18791;
const scriptPath = fileURLToPath(
  new URL("../../../../scripts/mock-buyer-host.mjs", import.meta.url),
);

let child: ChildProcess;
let identity: AgentIdentity;
let wellKnown: {
  protocol_versions: string[];
  platform_keys: Array<{ public_key: string; fingerprint: string }>;
};

const ENVELOPE = {
  party: "Draft Flow Test Vendor",
  agent: { name: "Draft Flow Test Agent", declared_ai: true },
  may_discuss: ["renewal pricing"],
  may_disclose: ["list pricing"],
  offer_authority: "propose_only",
};

function offer(unitPrice: number) {
  return {
    currency: "USD",
    term_months: 12,
    expires_at: "2027-01-01T00:00:00Z",
    line_items: [
      {
        description: "Draft flow seats",
        quantity: 10,
        unit: "seat/year",
        unit_price: unitPrice,
        currency: "USD",
      },
    ],
  };
}

beforeAll(async () => {
  child = spawn(process.execPath, [scriptPath], {
    env: { ...process.env, PORT: "18788", ANP_DRAFT: "1" },
    stdio: "ignore",
  });
  // Wait for the host to listen; the well-known endpoint doubles as the
  // readiness probe.
  const deadline = Date.now() + 15_000;
  for (;;) {
    try {
      const res = await fetch(`${HOST}/.well-known/anp.json`);
      if (res.ok) {
        wellKnown = (await res.json()) as typeof wellKnown;
        break;
      }
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error("mock host did not start");
    await new Promise((r) => setTimeout(r, 200));
  }
  identity = await generateIdentity();
  await register(HOST, identity, {
    agent_name: "Draft Flow Test Agent",
    vendor_name: "Draft Flow Test Vendor",
    contact_email: "draft@example.com",
  });
}, 30_000);

afterAll(() => {
  child?.kill();
});

describe("RFC-003: /.well-known/anp.json", () => {
  it("publishes protocol versions and a platform key whose fingerprint matches", async () => {
    expect(wellKnown.protocol_versions).toContain("ANP/0.1");
    const key = wellKnown.platform_keys[0];
    expect(await fingerprintOf(key.public_key)).toBe(key.fingerprint);
  });
});

describe("RFC-004: open_signature at session open", () => {
  it("stores a verifying open_signature inside the session_open payload", async () => {
    const envelopeHash = await sha256Hex(canonicalJson(ENVELOPE));
    const openSignature = await sign(
      identity.privateKey,
      `ANP/0.2\nsession_open_envelope\n${envelopeHash}`,
    );
    const url = `${HOST}/api/agent/v1/sessions`;
    const body = JSON.stringify({
      target: { sandbox: true },
      envelope: ENVELOPE,
      open_signature: openSignature,
    });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(await signedHeaders(identity, "POST", "/api/agent/v1/sessions", body)),
      },
      body,
    });
    expect(res.ok).toBe(true);
    const json = (await res.json()) as { log: SessionLog };
    const openPayload = json.log.events[0].payload as {
      open_signature?: string;
    };
    expect(openPayload.open_signature).toBe(openSignature);
    // The stored signature verifies against the vendor key over the
    // canonical envelope hash, and the chain covers it via payload_hash.
    expect(
      await verifySignature(
        identity.publicKey,
        openPayload.open_signature!,
        `ANP/0.2\nsession_open_envelope\n${envelopeHash}`,
      ),
    ).toBe(true);
  });

  it("refuses an open_signature that does not verify", async () => {
    const url = `${HOST}/api/agent/v1/sessions`;
    const body = JSON.stringify({
      target: { sandbox: true },
      envelope: ENVELOPE,
      open_signature: "AAAA",
    });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(await signedHeaders(identity, "POST", "/api/agent/v1/sessions", body)),
      },
      body,
    });
    expect(res.status).toBe(400);
  });
});

describe("RFC-001/002/005: accept with approval attestation", () => {
  let log: SessionLog;
  let sessionId: string;

  it("the sandbox buyer counters a high offer with in_response_to set", async () => {
    const opened = await openSession(HOST, identity, ENVELOPE, {
      sandbox: true,
    });
    sessionId = opened.sessionId;
    log = await sendEvent(HOST, identity, sessionId, "offer", offer(1200));
    const counter = log.events.find((e) => e.kind === "counter_offer");
    expect(counter).toBeDefined();
    const vendorOffer = log.events.find((e) => e.kind === "offer");
    expect((counter!.payload as { in_response_to: string }).in_response_to).toBe(
      vendorOffer!.event_hash,
    );
  });

  it("accepts a low offer with a verifiable human approval attestation", async () => {
    log = await sendEvent(HOST, identity, sessionId, "offer", offer(1000));
    const accept = log.events.find((e) => e.kind === ("accept" as never));
    expect(accept).toBeDefined();

    const payload = accept!.payload as {
      in_response_to: string;
      approval: {
        approved_by: string;
        at: string;
        method: string;
        signature: string;
      };
    };
    // References the exact low offer event.
    const lowOffer = log.events.filter((e) => e.kind === "offer").at(-1)!;
    expect(payload.in_response_to).toBe(lowOffer.event_hash);
    expect(payload.approval.method).toBe("human");

    // The approval signature verifies against the platform key published
    // at /.well-known/anp.json, independently of the log's keys block.
    const approvalString = `ANP/0.2\napproval\n${payload.in_response_to}\n${payload.approval.approved_by}\n${payload.approval.at}`;
    expect(
      await verifySignature(
        wellKnown.platform_keys[0].public_key,
        payload.approval.signature,
        approvalString,
      ),
    ).toBe(true);
  });

  it("the full chain including the accept event verifies", async () => {
    const verdict = await verifyLog(log, {
      keys: { [identity.fingerprint]: identity.publicKey },
    });
    expect(verdict.ok).toBe(true);
    expect(verdict.verifiedCount).toBe(verdict.eventCount);
  });

  it("refuses further offers after acceptance", async () => {
    await expect(
      sendEvent(HOST, identity, sessionId, "offer", offer(1300)),
    ).rejects.toThrow(/accepted/);
  });

  it("refuses an accept that references a nonexistent offer", async () => {
    const opened = await openSession(HOST, identity, ENVELOPE, {
      sandbox: true,
    });
    await expect(
      sendEvent(HOST, identity, opened.sessionId, "accept", {
        in_response_to: "a".repeat(64),
      }),
    ).rejects.toThrow(/does not reference/);
  });
});

describe("RFC-008: webhook hints", () => {
  it("POSTs a signed hint after buyer events, verifiable against the well-known key", async () => {
    const { createServer } = await import("node:http");
    let resolveHint!: (value: {
      body: Record<string, unknown>;
      signature: string;
      timestamp: string;
    }) => void;
    const hintReceived = new Promise<{
      body: Record<string, unknown>;
      signature: string;
      timestamp: string;
    }>((resolve) => {
      resolveHint = resolve;
    });
    const receiver = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        resolveHint({
          body: JSON.parse(raw) as Record<string, unknown>,
          signature: String(req.headers["x-anp-platform-signature"]),
          timestamp: String(req.headers["x-anp-timestamp"]),
        });
        res.writeHead(204).end();
      });
    });
    await new Promise<void>((r) => receiver.listen(RECEIVER_PORT, r));

    try {
      // Register a fresh identity with a webhook URL (raw request; the
      // 0.1 client's RegisterDetails has no webhook field by design).
      const hooked = await generateIdentity();
      const proof = await sign(
        hooked.privateKey,
        `ANP/0.1\nregister\n${hooked.publicKey}`,
      );
      const regRes = await fetch(`${HOST}/api/agent/v1/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent_name: "Webhook Test Agent",
          vendor_name: "Webhook Test Vendor",
          contact_email: "hooks@example.com",
          public_key: hooked.publicKey,
          proof,
          webhook_url: `http://127.0.0.1:${RECEIVER_PORT}/hint`,
        }),
      });
      expect(regRes.ok).toBe(true);
      hooked.agentId = ((await regRes.json()) as { agent_id: string }).agent_id;

      const opened = await openSession(HOST, hooked, ENVELOPE, {
        sandbox: true,
      });
      const log = await sendEvent(
        HOST,
        hooked,
        opened.sessionId,
        "offer",
        offer(1200),
      );

      const hint = await hintReceived;
      // The hint carries no event content, only pointers.
      expect(hint.body.session_id).toBe(opened.sessionId);
      expect(hint.body.event_count).toBe(log.events.length);
      expect(hint.body.chain_head).toBe(
        log.events[log.events.length - 1].event_hash,
      );
      // The platform signature verifies over the RFC-008 webhook string,
      // against the key published at /.well-known/anp.json.
      const webhookString = `ANP/0.2\nwebhook\n${hint.body.session_id}\n${hint.body.event_count}\n${hint.body.chain_head}\n${hint.body.at}`;
      expect(
        await verifySignature(
          wellKnown.platform_keys[0].public_key,
          hint.signature,
          webhookString,
        ),
      ).toBe(true);
    } finally {
      receiver.close();
    }
  });
});

describe("RFC-007: key rotation", () => {
  it("rotates to a new key, keeps the agent id, and old logs still verify", async () => {
    const opened = await openSession(HOST, identity, ENVELOPE, {
      sandbox: true,
    });
    await sendEvent(HOST, identity, opened.sessionId, "message", {
      body: "signed with the old key",
    });

    const next = await generateIdentity();
    const proof = await sign(
      next.privateKey,
      `ANP/0.2\nregister\n${next.publicKey}`,
    );
    const authorization = await sign(
      identity.privateKey,
      `ANP/0.2\nrotate\n${identity.fingerprint}\n${next.fingerprint}`,
    );
    const body = JSON.stringify({
      new_public_key: next.publicKey,
      proof,
      authorization,
    });
    const res = await fetch(`${HOST}/api/agent/v1/keys`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(await signedHeaders(identity, "POST", "/api/agent/v1/keys", body)),
      },
      body,
    });
    expect(res.ok).toBe(true);
    const json = (await res.json()) as { agent_id: string; fingerprint: string };
    expect(json.agent_id).toBe(identity.agentId);
    expect(json.fingerprint).toBe(next.fingerprint);

    // The old key no longer authenticates.
    await expect(
      fetchLog(HOST, identity, opened.sessionId),
    ).rejects.toThrow();

    // The new key does, with the same agent id, and events signed by the
    // rotated-out key still verify via the log's rotated key listing.
    next.agentId = identity.agentId;
    const log = await fetchLog(HOST, next, opened.sessionId);
    const verdict = await verifyLog(log);
    expect(verdict.ok).toBe(true);
    expect(verdict.verifiedCount).toBe(verdict.eventCount);
  });
});
