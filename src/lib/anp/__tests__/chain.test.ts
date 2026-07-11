import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SessionLog } from "../chain";
import { GENESIS_PREV_HASH, verifyLog } from "../chain";

const examplePath = fileURLToPath(
  new URL(
    "../../../../protocol/examples/session-log.example.json",
    import.meta.url,
  ),
);

function loadExample(): SessionLog {
  return JSON.parse(readFileSync(examplePath, "utf8")) as SessionLog;
}

function checksBySeq(
  verification: Awaited<ReturnType<typeof verifyLog>>,
  seq: number,
) {
  const event = verification.events.find((e) => e.seq === seq);
  if (!event) throw new Error(`no verification result for seq ${seq}`);
  return Object.fromEntries(event.checks.map((c) => [c.name, c]));
}

describe("verifyLog against the bundled example session log", () => {
  it("verifies fully green: every hash and every signature", async () => {
    const log = loadExample();
    const verification = await verifyLog(log);
    expect(verification.problems).toEqual([]);
    expect(verification.eventCount).toBe(4);
    expect(verification.verifiedCount).toBe(4);
    expect(verification.ok).toBe(true);
    for (const event of verification.events) {
      for (const check of event.checks) {
        expect(check.ok, `seq ${event.seq} check ${check.name}`).toBe(true);
      }
    }
  });

  it("starts the chain from 64 zeros", () => {
    const log = loadExample();
    expect(log.events[0].prev_hash).toBe(GENESIS_PREV_HASH);
  });

  it("flags a tampered payload as a payload_hash failure, not a signature failure", async () => {
    const log = loadExample();
    const offer = log.events[2].payload as { line_items: [{ unit_price: number }] };
    offer.line_items[0].unit_price = 1;

    const verification = await verifyLog(log);
    expect(verification.ok).toBe(false);
    expect(verification.verifiedCount).toBe(3);

    const checks = checksBySeq(verification, 3);
    expect(checks.payload_hash.ok).toBe(false);
    // The declared payload_hash still carries a valid signature: the chain
    // proves the *original* payload was signed, not the tampered one.
    expect(checks.signature.ok).toBe(true);
    expect(checks.prev_hash.ok).toBe(true);
    expect(checks.event_hash.ok).toBe(true);
  });

  it("flags a rewritten payload_hash as hash, chain and signature failures", async () => {
    const log = loadExample();
    log.events[2].payload_hash = "0".repeat(64);

    const verification = await verifyLog(log);
    const checks = checksBySeq(verification, 3);
    expect(checks.payload_hash.ok).toBe(false);
    expect(checks.event_hash.ok).toBe(false);
    expect(checks.signature.ok).toBe(false);
  });

  it("flags broken linkage on the event whose prev_hash was rewritten", async () => {
    const log = loadExample();
    log.events[3].prev_hash = "f".repeat(64);

    const verification = await verifyLog(log);
    const checks = checksBySeq(verification, 4);
    expect(checks.prev_hash.ok).toBe(false);
    expect(checks.event_hash.ok).toBe(false);
    // Earlier events stay green: tampering is localized to where it happened.
    expect(verification.events.filter((e) => e.ok).map((e) => e.seq)).toEqual([
      1, 2, 3,
    ]);
  });

  it("flags a swapped signer as a signature failure", async () => {
    const log = loadExample();
    const buyerFingerprint = log.events[1].signer;
    log.events[0].signer = buyerFingerprint;

    const verification = await verifyLog(log);
    const checks = checksBySeq(verification, 1);
    expect(checks.signature.ok).toBe(false);
  });

  it("flags non contiguous sequence numbers", async () => {
    const log = loadExample();
    log.events[2].seq = 7;

    const verification = await verifyLog(log);
    const checks = checksBySeq(verification, 7);
    expect(checks.seq.ok).toBe(false);
    // seq feeds the event_hash preimage, so the recompute fails too.
    expect(checks.event_hash.ok).toBe(false);
  });

  it("distrusts a keys block whose fingerprint does not match its key", async () => {
    const log = loadExample();
    const keys = log.keys as Record<
      string,
      { public_key: string; fingerprint: string }
    >;
    keys.vendor_agent.fingerprint = "a".repeat(64);

    const verification = await verifyLog(log);
    expect(verification.problems.length).toBeGreaterThan(0);
    expect(verification.ok).toBe(false);
    // Vendor-signed events can no longer verify their authorship.
    const checks = checksBySeq(verification, 1);
    expect(checks.signature.ok).toBe(false);
  });

  it("accepts extra keys passed by the caller", async () => {
    const log = loadExample();
    const keys = log.keys as Record<
      string,
      { public_key: string; fingerprint: string }
    >;
    const vendor = keys.vendor_agent;
    delete keys.vendor_agent;

    const missing = await verifyLog(log);
    expect(missing.ok).toBe(false);

    const supplied = await verifyLog(log, {
      keys: { [vendor.fingerprint]: vendor.public_key },
    });
    expect(supplied.ok).toBe(true);
  });

  it("treats an unsigned buyer event as acceptable", async () => {
    const log = loadExample();
    log.events[1].signature = null;
    log.events[1].signer = null;

    const verification = await verifyLog(log);
    const checks = checksBySeq(verification, 2);
    expect(checks.signature.ok).toBe(true);
    expect(checks.signature.detail).toMatch(/should/i);
  });

  it("rejects a signature without a declared signer", async () => {
    const log = loadExample();
    log.events[1].signer = null;
    const verification = await verifyLog(log);
    expect(checksBySeq(verification, 2).signature.ok).toBe(false);
  });

  it("accepts an unsigned event with a signer as recorded, unproven attribution", async () => {
    // The event schema allows signature to be null while signer is set;
    // section 4 only requires that signatures which exist verify.
    const log = loadExample();
    log.events[0].signature = null;
    const verification = await verifyLog(log);
    const check = checksBySeq(verification, 1).signature;
    expect(check.ok).toBe(true);
    expect(check.detail).toMatch(/not proven/i);
    expect(verification.ok).toBe(true);
  });
});
