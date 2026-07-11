/**
 * Byte and hash primitives shared by the ANP client modules.
 *
 * Everything here runs identically in Node (18+) and in browsers: the only
 * platform interface used is `globalThis.crypto.subtle`.
 */

/** Encode a string as UTF-8 bytes. */
export function utf8(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

/** Hex encode bytes, lowercase. */
export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/** Base64url encode bytes, without padding, per RFC 4648 section 5. */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a base64url string (padding optional) to bytes. */
export function fromBase64Url(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** SHA-256 of a string (UTF-8) or raw bytes, returned as lowercase hex. */
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? utf8(data) : data;
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    bytes as BufferSource,
  );
  return toHex(new Uint8Array(digest));
}

/** SHA-256 hex of the empty string, the body hash for bodyless requests. */
export const EMPTY_BODY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
