/**
 * A minimal ANP/0.1 vendor agent client for the buyer host endpoints of
 * section 6. Works in Node 18+ and in browsers: it uses `fetch` and
 * `globalThis.crypto` only.
 *
 * Typical flow:
 *
 * ```ts
 * const identity = await generateIdentity();
 * await register(host, identity, { agent_name, vendor_name, contact_email });
 * const opened = await openSession(host, identity, envelope, { sandbox: true });
 * const log = await sendEvent(host, identity, opened.sessionId, "offer", offer);
 * const verdict = await verifyLog(log);
 * ```
 */

import { canonicalJson } from "./canonicalJson";
import { EMPTY_BODY_SHA256, sha256Hex, toBase64Url } from "./encoding";
import type { SessionLog } from "./chain";
import {
  type AgentIdentity,
  authorshipString,
  canonicalRequestString,
  registrationProofString,
  sign,
} from "./signing";

/** Error raised for any non-2xx response from a buyer host. */
export class AnpClientError extends Error {
  /** The host's error code if it returned the uniform error shape. */
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AnpClientError";
    this.status = status;
    this.code = code;
  }
}

/** Registration details for `POST /api/agent/v1/register` (section 6.1). */
export interface RegisterDetails {
  agent_name: string;
  vendor_name: string;
  contact_email: string;
}

/** The host's answer to a registration. */
export interface RegisterResult {
  /** Host-assigned agent registration id (UUID). */
  agentId: string;
  /** SHA-256 hex fingerprint of the registered key, echoed by the host. */
  fingerprint: string;
  /** `sandbox` until a human verifies the registrant. */
  status: string;
  /** The full response body, for fields this client does not model. */
  raw: Record<string, unknown>;
}

/** A session's target: a buyer-issued org handle, or the sandbox. */
export type SessionTarget = { org_handle: string } | { sandbox: true };

/** The host's answer to opening a session (section 6.2). */
export interface OpenSessionResult {
  sessionId: string;
  /** The buyer's mandate envelope, declared in response to ours. */
  buyerEnvelope: unknown;
  log: SessionLog;
  raw: Record<string, unknown>;
}

function joinUrl(host: string, path: string): URL {
  return new URL(path, host.endsWith("/") ? host : host + "/");
}

function randomNonce(): string {
  const bytes = new Uint8Array(18);
  globalThis.crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function parseBody(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new AnpClientError(
      response.status,
      "invalid_response",
      `the host returned a non-JSON response (HTTP ${response.status})`,
    );
  }
  if (!response.ok) {
    const err = (json.error ?? {}) as { code?: string; message?: string };
    throw new AnpClientError(
      response.status,
      err.code ?? "error",
      err.message ?? `the host refused the request (HTTP ${response.status})`,
    );
  }
  return json;
}

/**
 * Build the four signed headers of section 3 for one request.
 *
 * The signature covers `ANP/0.1\n<METHOD>\n<PATH>\n<timestamp>\n<nonce>\n<body hash>`
 * where PATH is the URL path only and the body hash is the SHA-256 hex of
 * the exact bytes being sent (the hash of the empty string for bodyless
 * requests).
 */
export async function signedHeaders(
  identity: AgentIdentity,
  method: string,
  path: string,
  body?: string,
): Promise<Record<string, string>> {
  if (!identity.agentId) {
    throw new Error(
      "identity has no agentId; call register() before making signed requests",
    );
  }
  const timestamp = new Date().toISOString();
  const nonce = randomNonce();
  const bodyHash =
    body === undefined ? EMPTY_BODY_SHA256 : await sha256Hex(body);
  const signature = await sign(
    identity.privateKey,
    canonicalRequestString(method, path, timestamp, nonce, bodyHash),
  );
  return {
    "x-anp-agent": identity.agentId,
    "x-anp-timestamp": timestamp,
    "x-anp-nonce": nonce,
    "x-anp-signature": signature,
  };
}

/**
 * Register an identity with a buyer host (section 6.1). On success the
 * host-assigned agent id is also written to `identity.agentId`, which the
 * other client calls require. Registering an existing key returns the
 * existing identity.
 */
export async function register(
  host: string,
  identity: AgentIdentity,
  details: RegisterDetails,
): Promise<RegisterResult> {
  const proof = await sign(
    identity.privateKey,
    registrationProofString(identity.publicKey),
  );
  const response = await fetch(joinUrl(host, "api/agent/v1/register"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...details,
      public_key: identity.publicKey,
      proof,
    }),
  });
  const json = await parseBody(response);
  const agentId = String(
    json.agent_id ?? (json.agent as { id?: string } | undefined)?.id ?? "",
  );
  if (!agentId) {
    throw new AnpClientError(
      response.status,
      "invalid_response",
      "the host's registration response carries no agent id",
    );
  }
  identity.agentId = agentId;
  return {
    agentId,
    fingerprint: String(json.fingerprint ?? identity.fingerprint),
    status: String(json.status ?? "unknown"),
    raw: json,
  };
}

/**
 * Open a session (section 6.2) against an org handle or the sandbox,
 * declaring our vendor mandate envelope. The host appends `session_open`
 * and the buyer's `envelope` as events 1 and 2 and returns the log.
 */
export async function openSession(
  host: string,
  identity: AgentIdentity,
  envelope: unknown,
  target: SessionTarget,
): Promise<OpenSessionResult> {
  const url = joinUrl(host, "api/agent/v1/sessions");
  const body = JSON.stringify({ target, envelope });
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(await signedHeaders(identity, "POST", url.pathname, body)),
    },
    body,
  });
  const json = await parseBody(response);
  const log = (json.log ?? json) as SessionLog;
  const sessionId = String(
    json.session_id ?? log.session?.id ?? (json.id as string | undefined) ?? "",
  );
  if (!sessionId) {
    throw new AnpClientError(
      response.status,
      "invalid_response",
      "the host's session response carries no session id",
    );
  }
  return {
    sessionId,
    buyerEnvelope: json.buyer_envelope ?? json.envelope,
    log,
    raw: json,
  };
}

/**
 * Append an event to a session (section 6.3). The payload is hashed over
 * its canonical JSON and signed with the authorship signature
 * `ANP/0.1\n<kind>\n<payload_hash>`. Returns the updated log, which may
 * already include the buyer's response events.
 */
export async function sendEvent(
  host: string,
  identity: AgentIdentity,
  sessionId: string,
  kind: string,
  payload: unknown,
): Promise<SessionLog> {
  const payloadHash = await sha256Hex(canonicalJson(payload));
  const signature = await sign(
    identity.privateKey,
    authorshipString(kind, payloadHash),
  );
  const url = joinUrl(
    host,
    `api/agent/v1/sessions/${encodeURIComponent(sessionId)}/events`,
  );
  const body = JSON.stringify({ kind, payload, signature });
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(await signedHeaders(identity, "POST", url.pathname, body)),
    },
    body,
  });
  const json = await parseBody(response);
  return (json.log ?? json) as SessionLog;
}

/**
 * Fetch a session's full verifiable log (section 6.4). Signed, bodyless.
 */
export async function fetchLog(
  host: string,
  identity: AgentIdentity,
  sessionId: string,
): Promise<SessionLog> {
  const url = joinUrl(
    host,
    `api/agent/v1/sessions/${encodeURIComponent(sessionId)}/log`,
  );
  const response = await fetch(url, {
    method: "GET",
    headers: await signedHeaders(identity, "GET", url.pathname),
  });
  const json = await parseBody(response);
  return (json.log ?? json) as SessionLog;
}
