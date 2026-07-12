/**
 * A minimal in-memory ANP/0.1 buyer host for local development of the
 * playground, implementing the four endpoints of SPEC.md section 6 with a
 * deterministic scripted sandbox buyer and permissive CORS.
 *
 * This is a dev tool, not a reference host: state is in memory, rate limits
 * are absent, and live org handles are not supported (sandbox only).
 *
 *   npm run mock-host        # listens on http://localhost:8787
 */

import { createServer } from "node:http";
import { randomUUID, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020Import from "ajv/dist/2020.js";
import addFormatsImport from "ajv-formats";

const Ajv2020 = Ajv2020Import.default ?? Ajv2020Import;
const addFormats = addFormatsImport.default ?? addFormatsImport;

const { subtle } = webcrypto;

const schemasDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "protocol",
  "schemas",
);
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateEnvelope = ajv.compile(
  JSON.parse(readFileSync(join(schemasDir, "envelope.schema.json"), "utf8")),
);
const validateOffer = ajv.compile(
  JSON.parse(readFileSync(join(schemasDir, "offer.schema.json"), "utf8")),
);

/** Validate an event payload against the schema for its kind (§6.3). */
function payloadError(kind, payload) {
  if (kind === "offer" || kind === "counter_offer") {
    let candidate = payload;
    // RFC-005 draft: offers may carry in_response_to; validate it, then
    // check the remainder against the 0.1 schema.
    if (DRAFT && payload && typeof payload === "object" && "in_response_to" in payload) {
      const { in_response_to, ...rest } = payload;
      if (!/^[0-9a-f]{64}$/.test(String(in_response_to)))
        return "in_response_to must be a 64 hex event_hash";
      candidate = rest;
    }
    return validateOffer(candidate)
      ? null
      : `payload does not conform to offer.schema.json: ${ajv.errorsText(validateOffer.errors)}`;
  }
  if (DRAFT && kind === "accept") {
    // RFC-001/002 draft payload.
    if (!/^[0-9a-f]{64}$/.test(String(payload?.in_response_to ?? "")))
      return "accept requires in_response_to, the event_hash of the accepted offer";
    const allowed = ["in_response_to", "note", "approval"];
    const extra = Object.keys(payload).filter((k) => !allowed.includes(k));
    if (extra.length > 0) return `unknown keys in accept payload: ${extra.join(", ")}`;
    if (payload.note !== undefined && (typeof payload.note !== "string" || payload.note.length > 4000))
      return "note must be a string of at most 4000 characters";
    return null;
  }
  if (kind === "envelope") {
    return validateEnvelope(payload)
      ? null
      : `payload does not conform to envelope.schema.json: ${ajv.errorsText(validateEnvelope.errors)}`;
  }
  if (kind === "message") {
    if (typeof payload?.body !== "string" || payload.body.length === 0 || payload.body.length > 20000)
      return "message payload requires a body string of 1 to 20000 characters";
    const extra = Object.keys(payload).filter((k) => k !== "body" && k !== "subject");
    return extra.length > 0 ? `unknown keys in message payload: ${extra.join(", ")}` : null;
  }
  if (kind === "decline" || kind === "session_close") {
    const extra = Object.keys(payload ?? {}).filter((k) => k !== "reason");
    return extra.length > 0 ? `unknown keys in ${kind} payload: ${extra.join(", ")}` : null;
  }
  return null;
}
const PORT = Number(process.env.PORT ?? 8787);
const PROTOCOL = "ANP/0.1";
const GENESIS = "0".repeat(64);

/**
 * ANP_DRAFT=1 enables prototypes of the 0.2 proposals in proposals/:
 * the accept event with approval attestation (RFC-001/002), the
 * /.well-known/anp.json document (RFC-003), open_signature at session
 * open (RFC-004), in_response_to referencing (RFC-005), key rotation
 * (RFC-007), and webhook hints (RFC-008). Without the flag the host is
 * plain ANP/0.1.
 */
const DRAFT = process.env.ANP_DRAFT === "1";
const STARTED_AT = new Date().toISOString();

/* ---- primitives (kept dependency free and spec-literal) ----------------- */

const utf8 = (s) => new TextEncoder().encode(s);

function toHex(bytes) {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toB64u(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function fromB64u(s) {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

async function sha256Hex(data) {
  return toHex(await subtle.digest("SHA-256", typeof data === "string" ? utf8(data) : data));
}

/** Canonical JSON per section 4: sorted keys, no whitespace, UTF-8. */
function canonicalJson(value) {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "string" || t === "boolean") return JSON.stringify(value);
  if (t === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (t === "object") {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
  }
  throw new TypeError(`cannot canonicalize ${t}`);
}

async function importVerifyKey(publicKeyB64u) {
  return subtle.importKey("raw", fromB64u(publicKeyB64u), { name: "Ed25519" }, false, ["verify"]);
}

async function verify(publicKeyB64u, signatureB64u, message) {
  try {
    const key = await importVerifyKey(publicKeyB64u);
    return await subtle.verify({ name: "Ed25519" }, key, fromB64u(signatureB64u), utf8(message));
  } catch {
    return false;
  }
}

/* ---- the buyer platform key --------------------------------------------- */

const platform = await (async () => {
  const pair = await subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const raw = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
  return {
    privateKey: pair.privateKey,
    publicKey: toB64u(raw),
    fingerprint: await sha256Hex(raw),
  };
})();

async function platformSign(message) {
  return toB64u(new Uint8Array(await subtle.sign({ name: "Ed25519" }, platform.privateKey, utf8(message))));
}

/* ---- state ---------------------------------------------------------------- */

const agents = new Map(); // agentId -> { publicKey, fingerprint, name }
const agentsByKey = new Map(); // publicKey -> agentId
const sessions = new Map(); // sessionId -> { events, agentId, round, closed }
const seenNonces = new Set(); // `${agentId}:${nonce}`

/* ---- chain helpers -------------------------------------------------------- */

async function appendEvent(session, sessionId, actor, kind, payload, signature, signer) {
  const seq = session.events.length + 1;
  const prev = seq === 1 ? GENESIS : session.events[seq - 2].event_hash;
  const payloadHash = await sha256Hex(canonicalJson(payload));
  const at = new Date().toISOString();
  const eventHash = await sha256Hex(
    [PROTOCOL, sessionId, String(seq), actor, kind, payloadHash, prev, at].join("\n"),
  );
  session.events.push({
    seq,
    actor,
    kind,
    payload,
    payload_hash: payloadHash,
    prev_hash: prev,
    event_hash: eventHash,
    signature,
    signer,
    at,
  });
}

async function appendBuyerEvent(session, sessionId, kind, payload) {
  const payloadHash = await sha256Hex(canonicalJson(payload));
  const signature = await platformSign(`${PROTOCOL}\n${kind}\n${payloadHash}`);
  await appendEvent(session, sessionId, "buyer", kind, payload, signature, platform.fingerprint);
}

/**
 * RFC-008 draft: POST a signed hint to the agent's webhook after buyer
 * events append. Fire and forget; the log stays the source of truth.
 */
async function sendWebhookHint(agentId, sessionId, session) {
  const record = agents.get(agentId);
  if (!DRAFT || !record?.webhookUrl) return;
  const head = session.events[session.events.length - 1]?.event_hash ?? GENESIS;
  const at = new Date().toISOString();
  const signature = await platformSign(
    `ANP/0.2\nwebhook\n${sessionId}\n${session.events.length}\n${head}\n${at}`,
  );
  fetch(record.webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-anp-platform-signature": signature,
      "x-anp-timestamp": at,
    },
    body: JSON.stringify({
      protocol: "ANP/0.2",
      session_id: sessionId,
      event_count: session.events.length,
      chain_head: head,
      at,
    }),
  }).catch(() => {});
}

function logDocument(sessionId, session, agent) {
  const head = session.events.at(-1)?.event_hash ?? GENESIS;
  return {
    protocol: PROTOCOL,
    session: {
      id: sessionId,
      sandbox: true,
      status: session.closed ? "closed" : "open",
      opened_at: session.events[0]?.at ?? null,
      closed_at: null,
      event_count: session.events.length,
      chain_head: head,
    },
    chain: { verified: true, head },
    keys: {
      vendor_agent: { public_key: agent.publicKey, fingerprint: agent.fingerprint },
      buyer: { public_key: platform.publicKey, fingerprint: platform.fingerprint },
      // RFC-007 draft: rotated-out keys stay listed so events signed
      // before the rotation keep verifying.
      ...Object.fromEntries(
        (agent.history ?? []).map((k, i) => [`vendor_agent_rotated_${i + 1}`, k]),
      ),
    },
    events: session.events,
  };
}

/* ---- the deterministic sandbox buyer -------------------------------------- */

const BUYER_ENVELOPE = {
  party: "Fabrikam Industries (sandbox)",
  agent: { name: "Fabrikam Sandbox Negotiation Agent", declared_ai: true },
  may_discuss: ["renewal pricing", "term length", "payment terms", "support tier"],
  may_disclose: ["negotiation positions grounded in market benchmarks"],
  will_not_disclose: ["internal budget ceilings", "walk-away thresholds"],
  offer_authority: "bind_with_human_approval",
  human_contact: "procurement@fabrikam.example",
};

function counterOffer(offer, round) {
  // Deterministic: 12% below on the first round, then converge by halves.
  const factor = [0.88, 0.94, 0.97][Math.min(round, 2)];
  return {
    currency: offer.currency,
    term_months: Math.min(offer.term_months * 2, 120),
    expires_at: offer.expires_at,
    line_items: offer.line_items.map((item) => ({
      ...item,
      unit_price: Math.round(item.unit_price * factor * 100) / 100,
    })),
    conditions: [
      "Price hold through the full term",
      "Annual uplift capped at 3%",
    ],
    notes: `Fabrikam sandbox counters ${Math.round((1 - factor) * 100)}% below your position, grounded in the market band for this category.`,
  };
}

async function buyerRespond(session, sessionId, kind, payload) {
  if (kind === "offer" || kind === "counter_offer") {
    const vendorEvent = session.events[session.events.length - 1];
    const firstPrice = payload?.line_items?.[0]?.unit_price ?? Infinity;
    // RFC-001/002 draft: the sandbox buyer accepts a sufficiently low
    // offer, attesting the (simulated) human approval per RFC-002.
    if (DRAFT && firstPrice <= 1100) {
      const at = new Date().toISOString();
      const approvedBy = "procurement@fabrikam.example";
      const inResponseTo = vendorEvent.event_hash;
      await appendBuyerEvent(session, sessionId, "accept", {
        in_response_to: inResponseTo,
        approval: {
          approved_by: approvedBy,
          at,
          method: "human",
          signature: await platformSign(
            `ANP/0.2\napproval\n${inResponseTo}\n${approvedBy}\n${at}`,
          ),
        },
      });
      session.accepted = true;
      return;
    }
    const counter = counterOffer(payload, session.round);
    if (DRAFT) counter.in_response_to = vendorEvent.event_hash; // RFC-005
    await appendBuyerEvent(session, sessionId, "counter_offer", counter);
    session.round += 1;
  } else if (kind === "message") {
    await appendBuyerEvent(session, sessionId, "message", {
      body: "Acknowledged. The sandbox buyer negotiates on structured offers; send one and it will counter deterministically.",
    });
  } else if (kind === "accept") {
    session.accepted = true;
  } else if (kind === "decline" || kind === "session_close") {
    session.closed = true;
  }
}

/* ---- http plumbing --------------------------------------------------------- */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-anp-agent, x-anp-timestamp, x-anp-nonce, x-anp-signature",
};

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json", ...CORS });
  res.end(JSON.stringify(body));
}

function refuse(res) {
  // One uniform refusal for every authentication failure (section 3).
  send(res, 401, { error: { code: "refused", message: "The request was refused." }, protocol: PROTOCOL });
}

function badRequest(res, message) {
  send(res, 400, { error: { code: "bad_request", message }, protocol: PROTOCOL });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/** Verify the four signed headers of section 3. Returns the agent or null. */
async function authenticate(req, path, rawBody) {
  const agentId = req.headers["x-anp-agent"];
  const timestamp = req.headers["x-anp-timestamp"];
  const nonce = req.headers["x-anp-nonce"];
  const signature = req.headers["x-anp-signature"];
  if (!agentId || !timestamp || !nonce || !signature) return null;
  const agent = agents.get(agentId);
  if (!agent) return null;
  if (Math.abs(Date.now() - Date.parse(timestamp)) > 300_000) return null;
  if (nonce.length > 120 || seenNonces.has(`${agentId}:${nonce}`)) return null;
  const bodyHash = await sha256Hex(rawBody);
  const message = [PROTOCOL, req.method, path, timestamp, nonce, bodyHash].join("\n");
  if (!(await verify(agent.publicKey, signature, message))) return null;
  seenNonces.add(`${agentId}:${nonce}`);
  return { agentId, ...agent };
}

const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }

  try {
    if (req.method === "POST" && path === "/api/agent/v1/register") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const { agent_name, vendor_name, contact_email, public_key, proof } = body;
      if (typeof agent_name !== "string" || agent_name.length < 3 || agent_name.length > 120)
        return badRequest(res, "agent_name must be 3 to 120 characters.");
      if (!vendor_name || !contact_email) return badRequest(res, "vendor_name and contact_email are required.");
      if (typeof public_key !== "string" || fromB64u(public_key).length !== 32)
        return badRequest(res, "public_key must be a raw 32-byte Ed25519 key, base64url.");
      if (!(await verify(public_key, String(proof ?? ""), `${PROTOCOL}\nregister\n${public_key}`)))
        return badRequest(res, "proof of key possession does not verify.");

      // Registering an existing key returns the existing identity.
      let agentId = agentsByKey.get(public_key);
      if (!agentId) {
        agentId = randomUUID();
        const fingerprint = await sha256Hex(fromB64u(public_key));
        agents.set(agentId, { publicKey: public_key, fingerprint, name: agent_name });
        agentsByKey.set(public_key, agentId);
      }
      const agent = agents.get(agentId);
      // RFC-008 draft: an agent may register a webhook URL for hints.
      if (DRAFT && typeof body.webhook_url === "string" && /^https?:\/\//.test(body.webhook_url)) {
        agent.webhookUrl = body.webhook_url;
      }
      return send(res, 200, {
        agent_id: agentId,
        fingerprint: agent.fingerprint,
        status: "sandbox",
        protocol: PROTOCOL,
      });
    }

    const rawBody = req.method === "POST" ? await readBody(req) : "";

    // RFC-003 draft: capability discovery and platform key publication.
    if (DRAFT && req.method === "GET" && path === "/.well-known/anp.json") {
      return send(res, 200, {
        protocol_versions: [PROTOCOL, "ANP/0.2-draft"],
        api_base: "/api/agent/v1",
        platform_keys: [
          {
            public_key: platform.publicKey,
            fingerprint: platform.fingerprint,
            roles: ["events", "approval"],
            valid_from: STARTED_AT,
            valid_to: null,
          },
        ],
      });
    }

    // RFC-007 draft: key rotation with identity continuity.
    if (DRAFT && req.method === "POST" && path === "/api/agent/v1/keys") {
      const agent = await authenticate(req, path, rawBody);
      if (!agent) return refuse(res);
      const { new_public_key, proof, authorization } = JSON.parse(rawBody || "{}");
      if (typeof new_public_key !== "string" || fromB64u(new_public_key).length !== 32)
        return badRequest(res, "new_public_key must be a raw 32-byte Ed25519 key, base64url.");
      if (!(await verify(new_public_key, String(proof ?? ""), `ANP/0.2\nregister\n${new_public_key}`)))
        return badRequest(res, "proof of possession of the new key does not verify.");
      const newFingerprint = await sha256Hex(fromB64u(new_public_key));
      const authString = `ANP/0.2\nrotate\n${agent.fingerprint}\n${newFingerprint}`;
      if (!(await verify(agent.publicKey, String(authorization ?? ""), authString)))
        return badRequest(res, "rotation authorization by the old key does not verify.");
      const record = agents.get(agent.agentId);
      record.history = [
        ...(record.history ?? []),
        { public_key: record.publicKey, fingerprint: record.fingerprint },
      ];
      agentsByKey.delete(record.publicKey);
      record.publicKey = new_public_key;
      record.fingerprint = newFingerprint;
      agentsByKey.set(new_public_key, agent.agentId);
      return send(res, 200, {
        agent_id: agent.agentId,
        fingerprint: newFingerprint,
        status: "sandbox",
        protocol: PROTOCOL,
      });
    }

    if (req.method === "POST" && path === "/api/agent/v1/sessions") {
      const agent = await authenticate(req, path, rawBody);
      if (!agent) return refuse(res);
      const body = JSON.parse(rawBody || "{}");
      if (body?.target?.sandbox !== true)
        return badRequest(res, "This mock host supports only the sandbox target.");
      const envelopeError = payloadError("envelope", body?.envelope);
      if (envelopeError) return badRequest(res, envelopeError);

      // RFC-004 draft: an optional open_signature by the vendor's key
      // over the envelope's canonical hash, stored inside the payload so
      // the chain covers it.
      let openSignature = null;
      if (DRAFT && typeof body.open_signature === "string") {
        const envelopeHash = await sha256Hex(canonicalJson(body.envelope));
        const valid = await verify(
          agent.publicKey,
          body.open_signature,
          `ANP/0.2\nsession_open_envelope\n${envelopeHash}`,
        );
        if (!valid) return badRequest(res, "open_signature does not verify over the envelope.");
        openSignature = body.open_signature;
      }

      const sessionId = randomUUID();
      const session = { events: [], agentId: agent.agentId, round: 0, closed: false, accepted: false };
      sessions.set(sessionId, session);

      const openPayload = {
        protocol: PROTOCOL,
        agent: { id: agent.agentId, name: agent.name, fingerprint: agent.fingerprint },
        envelope: body.envelope,
        ...(openSignature ? { open_signature: openSignature } : {}),
      };
      // The host constructs and records events 1 and 2, signing both with
      // its platform key; the vendor's own events carry vendor signatures.
      const openHash = await sha256Hex(canonicalJson(openPayload));
      await appendEvent(
        session, sessionId, "vendor_agent", "session_open", openPayload,
        await platformSign(`${PROTOCOL}\nsession_open\n${openHash}`), platform.fingerprint,
      );
      await appendBuyerEvent(session, sessionId, "envelope", BUYER_ENVELOPE);

      return send(res, 200, {
        session_id: sessionId,
        buyer_envelope: BUYER_ENVELOPE,
        log: logDocument(sessionId, session, agent),
        protocol: PROTOCOL,
      });
    }

    const eventsMatch = path.match(/^\/api\/agent\/v1\/sessions\/([0-9a-f-]+)\/events$/);
    if (req.method === "POST" && eventsMatch) {
      const agent = await authenticate(req, path, rawBody);
      if (!agent) return refuse(res);
      const session = sessions.get(eventsMatch[1]);
      if (!session || session.agentId !== agent.agentId) return refuse(res);
      if (session.closed) return badRequest(res, "The session is closed.");

      const { kind, payload, signature } = JSON.parse(rawBody || "{}");
      const allowed = ["envelope", "offer", "counter_offer", "message", "decline", "session_close"];
      if (DRAFT) allowed.push("accept");
      if (!allowed.includes(kind)) return badRequest(res, `kind must be one of ${allowed.join(", ")}.`);
      const schemaError = payloadError(kind, payload);
      if (schemaError) return badRequest(res, schemaError);
      if (DRAFT && session.accepted && kind !== "message" && kind !== "session_close")
        return badRequest(res, "The session is accepted; only message and session_close may follow.");
      if (DRAFT && kind === "accept") {
        const target = session.events.find(
          (e) => e.event_hash === payload.in_response_to && (e.kind === "offer" || e.kind === "counter_offer"),
        );
        if (!target)
          return badRequest(res, "accept.in_response_to does not reference an offer event in this session.");
      }
      const payloadHash = await sha256Hex(canonicalJson(payload));
      if (!(await verify(agent.publicKey, String(signature ?? ""), `${PROTOCOL}\n${kind}\n${payloadHash}`)))
        return badRequest(res, "The authorship signature does not verify.");

      await appendEvent(session, eventsMatch[1], "vendor_agent", kind, payload, signature, agent.fingerprint);
      const before = session.events.length;
      await buyerRespond(session, eventsMatch[1], kind, payload);
      if (session.events.length > before) {
        void sendWebhookHint(agent.agentId, eventsMatch[1], session);
      }
      return send(res, 200, { log: logDocument(eventsMatch[1], session, agent), protocol: PROTOCOL });
    }

    const logMatch = path.match(/^\/api\/agent\/v1\/sessions\/([0-9a-f-]+)(\/log)?$/);
    if (req.method === "GET" && logMatch) {
      const agent = await authenticate(req, path, "");
      if (!agent) return refuse(res);
      const session = sessions.get(logMatch[1]);
      if (!session || session.agentId !== agent.agentId) return refuse(res);
      if (!logMatch[2]) {
        const head = session.events.at(-1)?.event_hash ?? GENESIS;
        return send(res, 200, {
          session: { id: logMatch[1], event_count: session.events.length, chain_head: head },
          protocol: PROTOCOL,
        });
      }
      return send(res, 200, logDocument(logMatch[1], session, agents.get(session.agentId)));
    }

    return send(res, 404, { error: { code: "not_found", message: "No such endpoint." }, protocol: PROTOCOL });
  } catch (err) {
    return badRequest(res, err instanceof Error ? err.message : "Malformed request.");
  }
});

server.listen(PORT, () => {
  console.log(`mock ANP buyer host listening on http://localhost:${PORT}`);
  console.log(`platform key fingerprint ${platform.fingerprint}`);
});
