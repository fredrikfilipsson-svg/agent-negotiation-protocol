/**
 * The reference TypeScript client for ANP/0.1, the Agent Negotiation
 * Protocol. Node 18+ and browser compatible; the only platform interfaces
 * used are `fetch` and `globalThis.crypto`.
 *
 * This module is written to be published as `@anp/client`.
 */

export { canonicalJson, canonicalJsonBytes } from "./canonicalJson";
export {
  EMPTY_BODY_SHA256,
  fromBase64Url,
  sha256Hex,
  toBase64Url,
  toHex,
  utf8,
} from "./encoding";
export {
  type AgentIdentity,
  authorshipString,
  canonicalRequestString,
  ed25519Supported,
  fingerprintOf,
  generateIdentity,
  importPublicKey,
  PROTOCOL_VERSION,
  registrationProofString,
  sign,
  verifySignature,
} from "./signing";
export {
  type AnpEvent,
  type ChainVerification,
  type CheckName,
  type EventCheck,
  type EventVerification,
  type SessionLog,
  computeEventHash,
  computePayloadHash,
  GENESIS_PREV_HASH,
  verifyLog,
} from "./chain";
export {
  AnpClientError,
  type OpenSessionResult,
  type RegisterDetails,
  type RegisterResult,
  type SessionTarget,
  fetchLog,
  openSession,
  register,
  sendEvent,
  signedHeaders,
} from "./client";
