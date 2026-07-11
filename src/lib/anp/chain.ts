/**
 * Session log verification per ANP/0.1 section 4.
 *
 * A log verifies when sequence numbers are contiguous from 1, every payload
 * re-hashes to its `payload_hash`, every `prev_hash` equals the previous
 * `event_hash`, every `event_hash` recomputes from its declared fields, and
 * every authorship signature verifies against its declared signer. The
 * verifier reports each check separately per event so callers can show
 * exactly what broke and why.
 */

import { canonicalJson } from "./canonicalJson";
import { sha256Hex } from "./encoding";
import {
  authorshipString,
  fingerprintOf,
  PROTOCOL_VERSION,
  verifySignature,
} from "./signing";

/** `prev_hash` of the first event in a chain: 64 zeros. */
export const GENESIS_PREV_HASH = "0".repeat(64);

/** One event in a session log, as defined by section 4. */
export interface AnpEvent {
  seq: number;
  actor: "vendor_agent" | "buyer";
  kind:
    | "session_open"
    | "envelope"
    | "offer"
    | "counter_offer"
    | "message"
    | "decline"
    | "session_close";
  payload: unknown;
  payload_hash: string;
  prev_hash: string;
  event_hash: string;
  signature: string | null;
  signer: string | null;
  at: string;
}

/** A session log document as returned by `GET .../log`. */
export interface SessionLog {
  protocol: string;
  session: {
    id: string;
    [key: string]: unknown;
  };
  /** Map of party name to its published key, used to verify signatures. */
  keys?: Record<
    string,
    { public_key?: string; fingerprint?: string; note?: string } | unknown
  >;
  events: AnpEvent[];
  [key: string]: unknown;
}

/** The names of the five per-event checks, in the order they are run. */
export type CheckName =
  | "seq"
  | "payload_hash"
  | "prev_hash"
  | "event_hash"
  | "signature";

/** Result of a single check on a single event. */
export interface EventCheck {
  name: CheckName;
  ok: boolean;
  /** Human-readable explanation, present for failures and notable passes. */
  detail?: string;
  expected?: string;
  actual?: string;
}

/** All checks for one event. */
export interface EventVerification {
  seq: number;
  ok: boolean;
  checks: EventCheck[];
}

/** The verdict for a whole log. */
export interface ChainVerification {
  ok: boolean;
  eventCount: number;
  /** Number of events for which every check passed. */
  verifiedCount: number;
  events: EventVerification[];
  /** Log-level problems not attributable to a single event. */
  problems: string[];
}

/**
 * Compute the `event_hash` preimage of section 4 and hash it:
 *
 * `sha256_hex("ANP/0.1" \n session_id \n seq \n actor \n kind \n payload_hash \n prev_hash \n at)`
 */
export async function computeEventHash(
  sessionId: string,
  event: Pick<
    AnpEvent,
    "seq" | "actor" | "kind" | "payload_hash" | "prev_hash" | "at"
  >,
): Promise<string> {
  const preimage = [
    PROTOCOL_VERSION,
    sessionId,
    String(event.seq),
    event.actor,
    event.kind,
    event.payload_hash,
    event.prev_hash,
    event.at,
  ].join("\n");
  return sha256Hex(preimage);
}

/** Compute a payload's hash: SHA-256 hex of its canonical JSON bytes. */
export async function computePayloadHash(payload: unknown): Promise<string> {
  return sha256Hex(canonicalJson(payload));
}

/**
 * Build a fingerprint to public key map from a log's `keys` block, checking
 * that each published key actually hashes to its declared fingerprint.
 * Mismatches are reported as problems and the key is not trusted.
 */
async function collectKeys(
  log: SessionLog,
  extraKeys: Record<string, string> | undefined,
  problems: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const [party, entry] of Object.entries(log.keys ?? {})) {
    if (typeof entry !== "object" || entry === null) continue;
    const { public_key, fingerprint } = entry as {
      public_key?: string;
      fingerprint?: string;
    };
    if (!public_key) continue;
    let actual: string;
    try {
      actual = await fingerprintOf(public_key);
    } catch {
      problems.push(`keys.${party}: public_key is not valid base64url`);
      continue;
    }
    if (fingerprint && fingerprint !== actual) {
      problems.push(
        `keys.${party}: declared fingerprint does not match the published key`,
      );
      continue;
    }
    map.set(actual, public_key);
  }
  for (const [fingerprint, publicKey] of Object.entries(extraKeys ?? {})) {
    map.set(fingerprint, publicKey);
  }
  return map;
}

/**
 * Verify a whole session log per section 4. Pure function of its inputs:
 * safe to re-run after every append, as the spec recommends.
 *
 * @param log the log document, including its `keys` block if present
 * @param options.keys additional fingerprint to base64url public key
 * mappings, for signers not listed in the log's own `keys` block
 */
export async function verifyLog(
  log: SessionLog,
  options?: { keys?: Record<string, string> },
): Promise<ChainVerification> {
  const problems: string[] = [];
  const keyMap = await collectKeys(log, options?.keys, problems);
  const events: EventVerification[] = [];

  if (log.protocol !== PROTOCOL_VERSION) {
    problems.push(
      `log declares protocol ${JSON.stringify(log.protocol)}, expected ${PROTOCOL_VERSION}`,
    );
  }

  let prevEventHash = GENESIS_PREV_HASH;
  for (let i = 0; i < log.events.length; i++) {
    const event = log.events[i];
    const checks: EventCheck[] = [];

    // 1. Contiguous sequence numbers from 1.
    const expectedSeq = i + 1;
    checks.push(
      event.seq === expectedSeq
        ? { name: "seq", ok: true }
        : {
            name: "seq",
            ok: false,
            expected: String(expectedSeq),
            actual: String(event.seq),
            detail: `sequence numbers must be contiguous from 1; position ${i} carries seq ${event.seq}`,
          },
    );

    // 2. Payload re-hashes to payload_hash.
    let payloadHash: string | null = null;
    try {
      payloadHash = await computePayloadHash(event.payload);
    } catch (err) {
      checks.push({
        name: "payload_hash",
        ok: false,
        detail: `payload cannot be canonicalized: ${(err as Error).message}`,
      });
    }
    if (payloadHash !== null) {
      checks.push(
        payloadHash === event.payload_hash
          ? { name: "payload_hash", ok: true }
          : {
              name: "payload_hash",
              ok: false,
              expected: event.payload_hash,
              actual: payloadHash,
              detail:
                "the payload does not hash to the declared payload_hash; the payload was altered after the hash was recorded",
            },
      );
    }

    // 3. prev_hash links to the previous event_hash (64 zeros for seq 1).
    checks.push(
      event.prev_hash === prevEventHash
        ? { name: "prev_hash", ok: true }
        : {
            name: "prev_hash",
            ok: false,
            expected: prevEventHash,
            actual: event.prev_hash,
            detail:
              i === 0
                ? "the first event's prev_hash must be 64 zeros"
                : "prev_hash does not equal the previous event's event_hash; the chain linkage is broken",
          },
    );

    // 4. event_hash recomputes from the declared fields.
    const recomputed = await computeEventHash(log.session.id, event);
    checks.push(
      recomputed === event.event_hash
        ? { name: "event_hash", ok: true }
        : {
            name: "event_hash",
            ok: false,
            expected: event.event_hash,
            actual: recomputed,
            detail:
              "event_hash does not recompute from seq, actor, kind, payload_hash, prev_hash and at; some hashed field was altered",
          },
    );

    // 5. Authorship signature verifies against the declared signer.
    if (event.signature && event.signer) {
      const publicKey = keyMap.get(event.signer);
      if (!publicKey) {
        checks.push({
          name: "signature",
          ok: false,
          detail: `no public key known for signer ${event.signer.slice(0, 16)}…; cannot verify authorship`,
        });
      } else {
        const valid = await verifySignature(
          publicKey,
          event.signature,
          authorshipString(event.kind, event.payload_hash),
        );
        checks.push(
          valid
            ? { name: "signature", ok: true }
            : {
                name: "signature",
                ok: false,
                detail:
                  "the Ed25519 signature over the authorship string does not verify against the declared signer's key",
              },
        );
      }
    } else if (event.signature && !event.signer) {
      // A signature with no declared signer cannot be checked against any
      // key; per section 4 every signature must verify against its signer.
      checks.push({
        name: "signature",
        ok: false,
        detail:
          "a signature is present but no signer is declared, so it cannot be verified against any key",
      });
    } else if (event.signer && !event.signature) {
      // The schema allows a null signature. Nothing fails, but nothing is
      // proven either: the signer field alone is attribution, not evidence.
      checks.push({
        name: "signature",
        ok: true,
        detail:
          "authorship is attributed to this signer but the event carries no signature; the attribution is recorded, not proven",
      });
    } else {
      checks.push({
        name: "signature",
        ok: true,
        detail:
          "no authorship signature present; vendor agents must sign, buyer hosts should",
      });
    }

    // The chain continues from the *declared* event_hash: a single bad event
    // is reported once rather than cascading a failure into every successor.
    prevEventHash = event.event_hash;

    events.push({
      seq: event.seq,
      ok: checks.every((c) => c.ok),
      checks,
    });
  }

  const verifiedCount = events.filter((e) => e.ok).length;
  return {
    ok: problems.length === 0 && verifiedCount === events.length,
    eventCount: events.length,
    verifiedCount,
    events,
    problems,
  };
}
