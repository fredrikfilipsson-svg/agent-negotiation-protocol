/**
 * Generates src/data/test-vectors.json: published, stable vectors that a
 * vendor agent (or any) implementation can test against. Uses the built
 * @anp/client package so the vectors are produced by the same code the
 * vitest suite proves against the published example log.
 *
 *   node packages/anp-client/sync-source.mjs && (cd packages/anp-client && npm run build)
 *   node scripts/generate-test-vectors.mjs
 *
 * The output is deterministic except the signature fixtures, which embed
 * a throwaway keypair's public half; regenerating rewrites those, which
 * is fine because each vector carries everything needed to verify it.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const anp = require(join(root, "packages", "anp-client", "dist", "index.js"));
const exampleLog = require(
  join(root, "protocol", "examples", "session-log.example.json"),
);

const {
  canonicalJson,
  sha256Hex,
  generateIdentity,
  sign,
  registrationProofString,
  canonicalRequestString,
  authorshipString,
  computeEventHash,
} = anp;

/* ---- 1. canonical JSON vectors ------------------------------------------ */

const canonicalCases = [
  {
    name: "keys sorted lexicographically at every depth",
    input: { zebra: 1, apple: { b: true, a: [{ y: 2, x: 1 }] }, "1st": null },
  },
  {
    name: "no insignificant whitespace",
    input: { a: [1, 2, { b: "c d" }] },
  },
  {
    name: "unicode is preserved, not escaped beyond JSON rules",
    input: { "kéy": "väl\nue 😀" },
  },
  {
    name: "number formatting follows ECMAScript JSON.stringify",
    input: { big: 1e21, frac: 0.1, negzero: -0, int: 1140 },
  },
  {
    name: "a realistic offer payload",
    input: exampleLog.events[2].payload,
  },
  {
    name: "a realistic envelope payload",
    input: exampleLog.events[1].payload,
  },
];

const canonical_json = [];
for (const c of canonicalCases) {
  const canonical = canonicalJson(c.input);
  canonical_json.push({
    name: c.name,
    input: c.input,
    canonical,
    sha256_hex: await sha256Hex(canonical),
  });
}

/* ---- 2. signed string vectors -------------------------------------------- */

const signed_strings = {
  note: "Exact UTF-8 strings that get signed. \\n is a single newline byte.",
  registration_proof: {
    public_key: "YSHFvQFoYEeBUsz2k4e28pqYf17kA8ottQi4ysdqjTc",
    string: registrationProofString(
      "YSHFvQFoYEeBUsz2k4e28pqYf17kA8ottQi4ysdqjTc",
    ),
  },
  canonical_request: {
    method: "POST",
    path: "/api/agent/v1/sessions",
    timestamp: "2026-07-11T09:00:00.000Z",
    nonce: "vector-nonce-001",
    body: '{"target":{"sandbox":true}}',
    body_sha256_hex: await sha256Hex('{"target":{"sandbox":true}}'),
    string: canonicalRequestString(
      "POST",
      "/api/agent/v1/sessions",
      "2026-07-11T09:00:00.000Z",
      "vector-nonce-001",
      await sha256Hex('{"target":{"sandbox":true}}'),
    ),
  },
  bodyless_request: {
    method: "GET",
    path: "/api/agent/v1/sessions/5f1c6f2e-9d1a-4c8b-b7e3-2a61c0de9a44/log",
    empty_body_sha256_hex: await sha256Hex(""),
  },
  authorship: {
    kind: "offer",
    payload_hash: exampleLog.events[2].payload_hash,
    string: authorshipString("offer", exampleLog.events[2].payload_hash),
  },
};

/* ---- 3. signature vectors ------------------------------------------------- */

const identity = await generateIdentity();
const messages = [
  registrationProofString(identity.publicKey),
  authorshipString("offer", exampleLog.events[2].payload_hash),
];
const signatures = [];
for (const message of messages) {
  signatures.push({
    public_key: identity.publicKey,
    signer_fingerprint: identity.fingerprint,
    message,
    signature: await sign(identity.privateKey, message),
    expect: "valid",
  });
}
signatures.push({
  public_key: identity.publicKey,
  signer_fingerprint: identity.fingerprint,
  message: messages[0] + "tampered",
  signature: signatures[0].signature,
  expect: "invalid",
});

/* ---- 4. event hash vector ------------------------------------------------- */

const ev = exampleLog.events[3];
const event_hash = {
  note: "sha256_hex of ANP/0.1\\n<session_id>\\n<seq>\\n<actor>\\n<kind>\\n<payload_hash>\\n<prev_hash>\\n<at>",
  session_id: exampleLog.session.id,
  event: {
    seq: ev.seq,
    actor: ev.actor,
    kind: ev.kind,
    payload_hash: ev.payload_hash,
    prev_hash: ev.prev_hash,
    at: ev.at,
  },
  expected_event_hash: ev.event_hash,
  recomputed: await computeEventHash(exampleLog.session.id, ev),
};
if (event_hash.recomputed !== event_hash.expected_event_hash) {
  throw new Error("event hash vector does not reproduce the example log");
}

/* ---- 5. chain verification vectors ---------------------------------------- */

const tamperedPayload = structuredClone(exampleLog);
tamperedPayload.events[2].payload.line_items[0].unit_price = 1;

const brokenLink = structuredClone(exampleLog);
brokenLink.events[3].prev_hash = "f".repeat(64);

const seqGap = structuredClone(exampleLog);
seqGap.events[2].seq = 7;

const chains = [
  {
    name: "the published example log verifies fully green",
    log: exampleLog,
    expect: { ok: true, failing: [] },
  },
  {
    name: "tampered payload: payload_hash fails on seq 3; the signature over the declared hash still verifies",
    log: tamperedPayload,
    expect: { ok: false, failing: [{ seq: 3, checks: ["payload_hash"] }] },
  },
  {
    name: "rewritten prev_hash: linkage and event_hash fail on seq 4",
    log: brokenLink,
    expect: {
      ok: false,
      failing: [{ seq: 4, checks: ["prev_hash", "event_hash"] }],
    },
  },
  {
    name: "sequence gap: seq and event_hash fail on the renumbered event",
    log: seqGap,
    expect: { ok: false, failing: [{ seq: 7, checks: ["seq", "event_hash"] }] },
  },
];

// Prove every chain vector against the same verifier the site ships.
for (const vector of chains) {
  const verdict = await anp.verifyLog(vector.log);
  if (verdict.ok !== vector.expect.ok) {
    throw new Error(`chain vector "${vector.name}" verdict mismatch`);
  }
  for (const failing of vector.expect.failing) {
    const event = verdict.events.find((e) => e.seq === failing.seq);
    const failed = event.checks.filter((c) => !c.ok).map((c) => c.name);
    for (const check of failing.checks) {
      if (!failed.includes(check)) {
        throw new Error(
          `chain vector "${vector.name}": expected ${check} to fail on seq ${failing.seq}`,
        );
      }
    }
  }
}

/* ---- write ----------------------------------------------------------------- */

const document = {
  title: "ANP/0.1 test vectors",
  description:
    "Vectors for implementers: canonical JSON bytes and hashes, the exact signed strings, Ed25519 signature fixtures, the event hash preimage, and chain verification cases. Produced by the reference implementation; the published example session log is the companion fixture.",
  spec: "https://aiaagentnetwork.com/spec",
  example_log: "https://aiaagentnetwork.com/schemas/session-log.example.json",
  canonical_json,
  signed_strings,
  signatures,
  event_hash,
  chain_verification: chains.map(({ name, log, expect }) => ({
    name,
    expect,
    log,
  })),
};

const out = join(root, "src", "data", "test-vectors.json");
writeFileSync(out, JSON.stringify(document, null, 2) + "\n");
console.log(`wrote ${out}`);
