/**
 * The runnable buyer host conformance harness. Runs entirely in the
 * browser against a host URL, exercising the observable requirements of
 * SPEC.md sections 2, 3, 4 and 6: proof of possession, uniform refusals,
 * replay protection, schema rejection, and a verifiable chain.
 *
 * Passing here is indicative, not a certification: the harness can only
 * observe wire behavior, not internal policy (human approval gates, rate
 * limit fail modes, outbound screening).
 */

import {
  type AgentIdentity,
  canonicalJson,
  canonicalRequestString,
  authorshipString,
  generateIdentity,
  openSession,
  register,
  sha256Hex,
  sign,
  toBase64Url,
  verifyLog,
} from "@/lib/anp";

export type TestStatus = "pass" | "fail" | "skip";

export interface TestResult {
  id: string;
  title: string;
  ref: string;
  status: TestStatus;
  detail: string;
}

export interface HarnessReport {
  host: string;
  startedAt: string;
  finishedAt: string;
  passed: number;
  failed: number;
  skipped: number;
  results: TestResult[];
}

const ENVELOPE = {
  party: "ANP Conformance Harness",
  agent: { name: "ANP Conformance Harness Agent", declared_ai: true },
  may_discuss: ["conformance testing"],
  may_disclose: ["test payloads"],
  offer_authority: "propose_only",
};

const VALID_OFFER = {
  currency: "USD",
  term_months: 12,
  expires_at: "2027-01-01T00:00:00Z",
  line_items: [
    {
      description: "Conformance test item",
      quantity: 1,
      unit: "unit",
      unit_price: 100,
      currency: "USD",
    },
  ],
};

function url(host: string, path: string): URL {
  return new URL(path, host.endsWith("/") ? host : host + "/");
}

function randomNonce(): string {
  const bytes = new Uint8Array(18);
  globalThis.crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/** A signed request with full control of timestamp, nonce, and signature. */
async function rawSignedRequest(
  host: string,
  identity: AgentIdentity,
  method: string,
  path: string,
  options: {
    body?: string;
    timestamp?: string;
    nonce?: string;
    signatureOverride?: string;
    agentIdOverride?: string;
  } = {},
): Promise<Response> {
  const target = url(host, path.replace(/^\//, ""));
  const timestamp = options.timestamp ?? new Date().toISOString();
  const nonce = options.nonce ?? randomNonce();
  const bodyHash = await sha256Hex(options.body ?? "");
  const signature =
    options.signatureOverride ??
    (await sign(
      identity.privateKey,
      canonicalRequestString(method, target.pathname, timestamp, nonce, bodyHash),
    ));
  return fetch(target, {
    method,
    headers: {
      ...(options.body !== undefined
        ? { "content-type": "application/json" }
        : {}),
      "x-anp-agent": options.agentIdOverride ?? identity.agentId ?? "",
      "x-anp-timestamp": timestamp,
      "x-anp-nonce": nonce,
      "x-anp-signature": signature,
    },
    body: options.body,
  });
}

async function refusalShape(
  res: Response,
): Promise<{ status: number; code: string | null; uniformShape: boolean }> {
  try {
    const json = (await res.json()) as {
      error?: { code?: string; message?: string };
      protocol?: string;
    };
    return {
      status: res.status,
      code: json.error?.code ?? null,
      uniformShape:
        typeof json.error?.code === "string" &&
        typeof json.error?.message === "string" &&
        json.protocol === "ANP/0.1",
    };
  } catch {
    return { status: res.status, code: null, uniformShape: false };
  }
}

/**
 * Run the full harness. Reports progress per test via `onResult` and
 * returns the complete report. Network failures surface as failed tests
 * with the underlying message, not as thrown errors.
 */
export async function runConformance(
  host: string,
  onResult: (result: TestResult) => void,
): Promise<HarnessReport> {
  const startedAt = new Date().toISOString();
  const results: TestResult[] = [];
  const push = (result: TestResult) => {
    results.push(result);
    onResult(result);
  };

  let identity: AgentIdentity | null = null;
  let sessionId: string | null = null;
  // Accessors defeat TypeScript's flow narrowing, which cannot see that the
  // earlier awaited closures assigned these.
  const getIdentity = (): AgentIdentity | null => identity;
  const getSessionId = (): string | null => sessionId;

  // 1. Registration must reject a proof signed by the wrong key.
  await (async () => {
    const id = "register-rejects-bad-proof";
    const title = "Registration rejects a proof of possession from the wrong key";
    const ref = "§2";
    try {
      const a = await generateIdentity();
      const b = await generateIdentity();
      const badProof = await sign(
        b.privateKey,
        `ANP/0.1\nregister\n${a.publicKey}`,
      );
      const res = await fetch(url(host, "api/agent/v1/register"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent_name: "Conformance Harness",
          vendor_name: "ANP Conformance",
          contact_email: "conformance@aiaagentnetwork.com",
          public_key: a.publicKey,
          proof: badProof,
        }),
      });
      push(
        res.ok
          ? {
              id,
              title,
              ref,
              status: "fail",
              detail: `the host accepted a registration whose proof was signed by a different key (HTTP ${res.status})`,
            }
          : {
              id,
              title,
              ref,
              status: "pass",
              detail: `refused with HTTP ${res.status}`,
            },
      );
    } catch (err) {
      push({ id, title, ref, status: "fail", detail: `request failed: ${(err as Error).message}` });
    }
  })();

  // 2. A valid registration succeeds.
  await (async () => {
    const id = "register-accepts-valid";
    const title = "Registration accepts a valid key with proof of possession";
    const ref = "§6.1";
    try {
      identity = await generateIdentity();
      const result = await register(host, identity, {
        agent_name: "Conformance Harness",
        vendor_name: "ANP Conformance",
        contact_email: "conformance@aiaagentnetwork.com",
      });
      push({
        id,
        title,
        ref,
        status: "pass",
        detail: `agent ${result.agentId}, status ${result.status}`,
      });
    } catch (err) {
      identity = null;
      push({ id, title, ref, status: "fail", detail: (err as Error).message });
    }
  })();

  // 3. Re-registering the same key returns the existing identity.
  await (async () => {
    const id = "register-idempotent";
    const title = "Registering an existing key returns the existing identity";
    const ref = "§6.1";
    const me = getIdentity();
    if (!me) {
      return push({ id, title, ref, status: "skip", detail: "no registered identity" });
    }
    try {
      const firstAgentId = me.agentId;
      const again = await register(host, me, {
        agent_name: "Conformance Harness",
        vendor_name: "ANP Conformance",
        contact_email: "conformance@aiaagentnetwork.com",
      });
      push(
        again.agentId === firstAgentId
          ? { id, title, ref, status: "pass", detail: `same agent id returned` }
          : {
              id,
              title,
              ref,
              status: "fail",
              detail: `a second registration of the same key produced a different agent id (${firstAgentId} then ${again.agentId})`,
            },
      );
      me.agentId = firstAgentId ?? again.agentId;
    } catch (err) {
      push({ id, title, ref, status: "fail", detail: (err as Error).message });
    }
  })();

  // 4. Unauthenticated requests get a uniform refusal.
  await (async () => {
    const id = "unauthenticated-refused";
    const title = "A request without the four signed headers is refused with the uniform error shape";
    const ref = "§3, §6";
    try {
      const res = await fetch(url(host, "api/agent/v1/sessions"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: { sandbox: true }, envelope: ENVELOPE }),
      });
      const shape = await refusalShape(res);
      if (res.ok) {
        push({ id, title, ref, status: "fail", detail: "the host opened a session for an unauthenticated request" });
      } else {
        push({
          id,
          title,
          ref,
          status: shape.uniformShape ? "pass" : "fail",
          detail: shape.uniformShape
            ? `refused with HTTP ${shape.status}, uniform shape`
            : `refused with HTTP ${shape.status}, but the body is not the uniform { error: { code, message }, protocol } shape`,
        });
      }
    } catch (err) {
      push({ id, title, ref, status: "fail", detail: `request failed: ${(err as Error).message}` });
    }
  })();

  // 5. A garbage signature and an unknown agent id are indistinguishable.
  await (async () => {
    const id = "uniform-refusals";
    const title = "A bad signature and an unknown agent id produce indistinguishable refusals";
    const ref = "§3, §7";
    const me = getIdentity();
    if (!me) {
      return push({ id, title, ref, status: "skip", detail: "no registered identity" });
    }
    try {
      const body = JSON.stringify({ target: { sandbox: true }, envelope: ENVELOPE });
      const badSig = await rawSignedRequest(host, me, "POST", "/api/agent/v1/sessions", {
        body,
        signatureOverride: toBase64Url(new Uint8Array(64)),
      });
      const unknownAgent = await rawSignedRequest(host, me, "POST", "/api/agent/v1/sessions", {
        body,
        agentIdOverride: globalThis.crypto.randomUUID(),
      });
      const a = await refusalShape(badSig);
      const b = await refusalShape(unknownAgent);
      if (badSig.ok || unknownAgent.ok) {
        return push({ id, title, ref, status: "fail", detail: "a forged request was accepted" });
      }
      push(
        a.status === b.status && a.code === b.code
          ? { id, title, ref, status: "pass", detail: `both refused with HTTP ${a.status}, code ${a.code}` }
          : {
              id,
              title,
              ref,
              status: "fail",
              detail: `refusals differ (bad signature: HTTP ${a.status}/${a.code}; unknown agent: HTTP ${b.status}/${b.code}), which lets a prober distinguish valid agent ids`,
            },
      );
    } catch (err) {
      push({ id, title, ref, status: "fail", detail: `request failed: ${(err as Error).message}` });
    }
  })();

  // 6. Stale timestamps are refused.
  await (async () => {
    const id = "timestamp-window";
    const title = "A request timestamped outside the 300 second window is refused";
    const ref = "§3";
    const me = getIdentity();
    if (!me) {
      return push({ id, title, ref, status: "skip", detail: "no registered identity" });
    }
    try {
      const body = JSON.stringify({ target: { sandbox: true }, envelope: ENVELOPE });
      const res = await rawSignedRequest(host, me, "POST", "/api/agent/v1/sessions", {
        body,
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      });
      push(
        res.ok
          ? { id, title, ref, status: "fail", detail: "a request timestamped 10 minutes in the past was accepted" }
          : { id, title, ref, status: "pass", detail: `refused with HTTP ${res.status}` },
      );
    } catch (err) {
      push({ id, title, ref, status: "fail", detail: `request failed: ${(err as Error).message}` });
    }
  })();

  // 7. A sandbox session opens with events 1 and 2 in place.
  await (async () => {
    const id = "sandbox-session-opens";
    const title = "A sandbox session opens; the host appends session_open and the buyer envelope as events 1 and 2";
    const ref = "§6.2";
    const me = getIdentity();
    if (!me) {
      return push({ id, title, ref, status: "skip", detail: "no registered identity" });
    }
    try {
      const opened = await openSession(host, me, ENVELOPE, { sandbox: true });
      sessionId = opened.sessionId;
      const kinds = opened.log.events.map((e) => e.kind);
      push(
        kinds[0] === "session_open" && kinds[1] === "envelope"
          ? { id, title, ref, status: "pass", detail: `session ${opened.sessionId}, events [${kinds.join(", ")}]` }
          : { id, title, ref, status: "fail", detail: `expected events 1 and 2 to be session_open and envelope, got [${kinds.join(", ")}]` },
      );
    } catch (err) {
      push({ id, title, ref, status: "fail", detail: (err as Error).message });
    }
  })();

  // 8. Nonce replay is refused.
  await (async () => {
    const id = "nonce-replay-refused";
    const title = "A reused (agent, nonce) pair is refused";
    const ref = "§3, §7";
    const me = getIdentity();
    const sid = getSessionId();
    if (!me || !sid) {
      return push({ id, title, ref, status: "skip", detail: "no open session" });
    }
    try {
      const nonce = randomNonce();
      const path = `/api/agent/v1/sessions/${sid}`;
      const first = await rawSignedRequest(host, me, "GET", path, { nonce });
      const second = await rawSignedRequest(host, me, "GET", path, { nonce });
      if (!first.ok) {
        return push({ id, title, ref, status: "fail", detail: `the first use of the nonce was already refused (HTTP ${first.status})` });
      }
      push(
        second.ok
          ? { id, title, ref, status: "fail", detail: "the same (agent, nonce) pair was accepted twice" }
          : { id, title, ref, status: "pass", detail: `replay refused with HTTP ${second.status}` },
      );
    } catch (err) {
      push({ id, title, ref, status: "fail", detail: `request failed: ${(err as Error).message}` });
    }
  })();

  // 9. Schema-invalid payloads are rejected, not ignored.
  await (async () => {
    const id = "schema-rejection";
    const title = "An offer with an unknown key is rejected even when correctly signed";
    const ref = "§5.2, §6.3";
    const me = getIdentity();
    const sid = getSessionId();
    if (!me || !sid) {
      return push({ id, title, ref, status: "skip", detail: "no open session" });
    }
    try {
      const invalidOffer = { ...VALID_OFFER, surprise_key: true };
      const payloadHash = await sha256Hex(canonicalJson(invalidOffer));
      const signature = await sign(me.privateKey, authorshipString("offer", payloadHash));
      const body = JSON.stringify({ kind: "offer", payload: invalidOffer, signature });
      const res = await rawSignedRequest(host, me, "POST", `/api/agent/v1/sessions/${sid}/events`, { body });
      push(
        res.ok
          ? { id, title, ref, status: "fail", detail: "the host accepted an offer containing an unknown key" }
          : { id, title, ref, status: "pass", detail: `rejected with HTTP ${res.status}` },
      );
    } catch (err) {
      push({ id, title, ref, status: "fail", detail: `request failed: ${(err as Error).message}` });
    }
  })();

  // 10. A valid offer appends and the whole chain verifies.
  await (async () => {
    const id = "chain-verifies";
    const title = "After a valid offer, the full log verifies: hashes, linkage, and signatures";
    const ref = "§4";
    const me = getIdentity();
    const sid = getSessionId();
    if (!me || !sid) {
      return push({ id, title, ref, status: "skip", detail: "no open session" });
    }
    try {
      const payloadHash = await sha256Hex(canonicalJson(VALID_OFFER));
      const signature = await sign(me.privateKey, authorshipString("offer", payloadHash));
      const body = JSON.stringify({ kind: "offer", payload: VALID_OFFER, signature });
      const res = await rawSignedRequest(host, me, "POST", `/api/agent/v1/sessions/${sid}/events`, { body });
      if (!res.ok) {
        return push({ id, title, ref, status: "fail", detail: `a schema-valid, correctly signed offer was rejected (HTTP ${res.status})` });
      }
      const json = (await res.json()) as { log?: unknown };
      const log = (json.log ?? json) as Parameters<typeof verifyLog>[0];
      const verdict = await verifyLog(log, {
        keys: { [me.fingerprint]: me.publicKey },
      });
      push(
        verdict.ok
          ? { id, title, ref, status: "pass", detail: `${verdict.verifiedCount} of ${verdict.eventCount} events verify` }
          : {
              id,
              title,
              ref,
              status: "fail",
              detail: `${verdict.verifiedCount} of ${verdict.eventCount} events verify; ${[
                ...verdict.problems,
                ...verdict.events
                  .filter((e) => !e.ok)
                  .map((e) => `seq ${e.seq}: ${e.checks.filter((c) => !c.ok).map((c) => c.name).join(", ")}`),
              ].join("; ")}`,
            },
      );
    } catch (err) {
      push({ id, title, ref, status: "fail", detail: `request failed: ${(err as Error).message}` });
    }
  })();

  const finishedAt = new Date().toISOString();
  return {
    host,
    startedAt,
    finishedAt,
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status === "fail").length,
    skipped: results.filter((r) => r.status === "skip").length,
    results,
  };
}
