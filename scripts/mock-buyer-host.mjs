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
    return validateOffer(payload)
      ? null
      : `payload does not conform to offer.schema.json: ${ajv.errorsText(validateOffer.errors)}`;
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
    await appendBuyerEvent(session, sessionId, "counter_offer", counterOffer(payload, session.round));
    session.round += 1;
  } else if (kind === "message") {
    await appendBuyerEvent(session, sessionId, "message", {
      body: "Acknowledged. The sandbox buyer negotiates on structured offers; send one and it will counter deterministically.",
    });
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
      return send(res, 200, {
        agent_id: agentId,
        fingerprint: agent.fingerprint,
        status: "sandbox",
        protocol: PROTOCOL,
      });
    }

    const rawBody = req.method === "POST" ? await readBody(req) : "";

    if (req.method === "POST" && path === "/api/agent/v1/sessions") {
      const agent = await authenticate(req, path, rawBody);
      if (!agent) return refuse(res);
      const body = JSON.parse(rawBody || "{}");
      if (body?.target?.sandbox !== true)
        return badRequest(res, "This mock host supports only the sandbox target.");
      const envelopeError = payloadError("envelope", body?.envelope);
      if (envelopeError) return badRequest(res, envelopeError);

      const sessionId = randomUUID();
      const session = { events: [], agentId: agent.agentId, round: 0, closed: false };
      sessions.set(sessionId, session);

      const openPayload = {
        protocol: PROTOCOL,
        agent: { id: agent.agentId, name: agent.name, fingerprint: agent.fingerprint },
        envelope: body.envelope,
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
      if (!allowed.includes(kind)) return badRequest(res, `kind must be one of ${allowed.join(", ")}.`);
      const schemaError = payloadError(kind, payload);
      if (schemaError) return badRequest(res, schemaError);
      const payloadHash = await sha256Hex(canonicalJson(payload));
      if (!(await verify(agent.publicKey, String(signature ?? ""), `${PROTOCOL}\n${kind}\n${payloadHash}`)))
        return badRequest(res, "The authorship signature does not verify.");

      await appendEvent(session, eventsMatch[1], "vendor_agent", kind, payload, signature, agent.fingerprint);
      await buyerRespond(session, eventsMatch[1], kind, payload);
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
