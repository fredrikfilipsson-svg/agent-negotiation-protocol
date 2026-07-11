/**
 * Ed25519 identity and the three signed strings defined by ANP/0.1:
 * the registration proof (section 2), the canonical request string
 * (section 3), and the event authorship string (section 4).
 *
 * Uses `globalThis.crypto.subtle` only, so it runs unmodified in Node 18+
 * and in browsers that implement WebCrypto Ed25519.
 */

import {
  fromBase64Url,
  sha256Hex,
  toBase64Url,
  utf8,
} from "./encoding";

/** The protocol version string baked into every signature and hash. */
export const PROTOCOL_VERSION = "ANP/0.1";

const ED25519 = { name: "Ed25519" } as const;

/**
 * An agent identity: a raw 32-byte Ed25519 keypair. The private key never
 * needs to leave the process that generated it; only `publicKey` (base64url)
 * is ever sent to a host. `agentId` is assigned by the host at registration
 * and filled in by {@link register}.
 */
export interface AgentIdentity {
  /** Raw 32-byte Ed25519 public key, base64url encoded. */
  publicKey: string;
  /** SHA-256 hex of the raw public key bytes, the human-facing identity. */
  fingerprint: string;
  /** WebCrypto handle for signing. Not extractable by default. */
  privateKey: CryptoKey;
  /** WebCrypto handle for local verification. */
  publicCryptoKey: CryptoKey;
  /** Host-assigned registration id (UUID), set after registration. */
  agentId?: string;
}

/**
 * Detect WebCrypto Ed25519 support in the current runtime. Some browsers
 * (and older Node versions) do not implement the algorithm; callers should
 * check this once and present a clear message instead of a thrown error.
 */
export async function ed25519Supported(): Promise<boolean> {
  try {
    const pair = (await globalThis.crypto.subtle.generateKey(ED25519, false, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    return Boolean(pair.privateKey && pair.publicKey);
  } catch {
    return false;
  }
}

/**
 * Generate a fresh Ed25519 identity. The private key is created
 * non-extractable: it can sign, but its bytes cannot be exported.
 */
export async function generateIdentity(): Promise<AgentIdentity> {
  // extractable=false applies to the private key; public keys are always
  // exportable, which is all we need for the raw key and its fingerprint.
  const pair = (await globalThis.crypto.subtle.generateKey(ED25519, false, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(
    await globalThis.crypto.subtle.exportKey("raw", pair.publicKey),
  );
  return {
    publicKey: toBase64Url(raw),
    fingerprint: await sha256Hex(raw),
    privateKey: pair.privateKey,
    publicCryptoKey: pair.publicKey,
  };
}

/** Import a base64url raw Ed25519 public key for verification. */
export async function importPublicKey(
  publicKeyBase64Url: string,
): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    fromBase64Url(publicKeyBase64Url) as BufferSource,
    ED25519,
    true,
    ["verify"],
  );
}

/** Fingerprint of a base64url public key: SHA-256 hex of the raw bytes. */
export async function fingerprintOf(
  publicKeyBase64Url: string,
): Promise<string> {
  return sha256Hex(fromBase64Url(publicKeyBase64Url));
}

/** Sign a UTF-8 string (or raw bytes) and return the base64url signature. */
export async function sign(
  privateKey: CryptoKey,
  message: string | Uint8Array,
): Promise<string> {
  const bytes = typeof message === "string" ? utf8(message) : message;
  const sig = await globalThis.crypto.subtle.sign(
    ED25519,
    privateKey,
    bytes as BufferSource,
  );
  return toBase64Url(new Uint8Array(sig));
}

/** Verify a base64url signature over a UTF-8 string or raw bytes. */
export async function verifySignature(
  publicKeyBase64Url: string,
  signatureBase64Url: string,
  message: string | Uint8Array,
): Promise<boolean> {
  try {
    const key = await importPublicKey(publicKeyBase64Url);
    const bytes = typeof message === "string" ? utf8(message) : message;
    return await globalThis.crypto.subtle.verify(
      ED25519,
      key,
      fromBase64Url(signatureBase64Url) as BufferSource,
      bytes as BufferSource,
    );
  } catch {
    return false;
  }
}

/**
 * The registration proof string of section 2. Signing it proves possession
 * of the private key matching `publicKeyBase64Url`.
 *
 * `ANP/0.1\nregister\n<public_key_base64url>`
 */
export function registrationProofString(publicKeyBase64Url: string): string {
  return `${PROTOCOL_VERSION}\nregister\n${publicKeyBase64Url}`;
}

/**
 * The canonical request string of section 3, signed into the
 * `x-anp-signature` header of every authenticated request.
 *
 * `ANP/0.1\n<METHOD>\n<PATH>\n<timestamp>\n<nonce>\n<sha256_hex_of_body>`
 *
 * @param method uppercase HTTP method
 * @param path URL path only, no query string, no host
 * @param bodySha256Hex SHA-256 hex of the exact request body bytes; for
 * bodyless requests, the hash of the empty string
 */
export function canonicalRequestString(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  bodySha256Hex: string,
): string {
  return `${PROTOCOL_VERSION}\n${method}\n${path}\n${timestamp}\n${nonce}\n${bodySha256Hex}`;
}

/**
 * The event authorship string of section 4, signed by the party submitting
 * an event: `ANP/0.1\n<kind>\n<payload_hash>`.
 */
export function authorshipString(kind: string, payloadHash: string): string {
  return `${PROTOCOL_VERSION}\n${kind}\n${payloadHash}`;
}
