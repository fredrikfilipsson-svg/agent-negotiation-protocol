import { describe, expect, it } from "vitest";
import {
  authorshipString,
  canonicalRequestString,
  ed25519Supported,
  fingerprintOf,
  generateIdentity,
  registrationProofString,
  sign,
  verifySignature,
} from "../signing";
import { EMPTY_BODY_SHA256, fromBase64Url, sha256Hex } from "../encoding";

describe("signed strings (exact bytes)", () => {
  it("builds the registration proof string of section 2", () => {
    expect(registrationProofString("PUBKEY_B64U")).toBe(
      "ANP/0.1\nregister\nPUBKEY_B64U",
    );
  });

  it("builds the canonical request string of section 3", () => {
    const s = canonicalRequestString(
      "POST",
      "/api/agent/v1/sessions",
      "2026-07-11T09:00:00.000Z",
      "nonce-123",
      "ab".repeat(32),
    );
    expect(s).toBe(
      "ANP/0.1\nPOST\n/api/agent/v1/sessions\n2026-07-11T09:00:00.000Z\nnonce-123\n" +
        "ab".repeat(32),
    );
  });

  it("builds the authorship string of section 4", () => {
    expect(authorshipString("offer", "deadbeef")).toBe(
      "ANP/0.1\noffer\ndeadbeef",
    );
  });

  it("knows the SHA-256 of the empty string for bodyless requests", async () => {
    expect(await sha256Hex("")).toBe(EMPTY_BODY_SHA256);
  });
});

describe("Ed25519 identity", () => {
  it("is supported by this runtime", async () => {
    expect(await ed25519Supported()).toBe(true);
  });

  it("generates a 32-byte key whose fingerprint is the SHA-256 of the raw bytes", async () => {
    const identity = await generateIdentity();
    const raw = fromBase64Url(identity.publicKey);
    expect(raw.length).toBe(32);
    expect(identity.fingerprint).toBe(await sha256Hex(raw));
    expect(identity.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(await fingerprintOf(identity.publicKey)).toBe(identity.fingerprint);
  });

  it("signs and verifies round trip", async () => {
    const identity = await generateIdentity();
    const message = registrationProofString(identity.publicKey);
    const signature = await sign(identity.privateKey, message);
    expect(await verifySignature(identity.publicKey, signature, message)).toBe(
      true,
    );
    expect(
      await verifySignature(identity.publicKey, signature, message + "x"),
    ).toBe(false);
  });

  it("rejects signatures from a different key", async () => {
    const a = await generateIdentity();
    const b = await generateIdentity();
    const signature = await sign(a.privateKey, "hello");
    expect(await verifySignature(b.publicKey, signature, "hello")).toBe(false);
  });

  it("keeps the private key non extractable", async () => {
    const identity = await generateIdentity();
    expect(identity.privateKey.extractable).toBe(false);
  });
});
