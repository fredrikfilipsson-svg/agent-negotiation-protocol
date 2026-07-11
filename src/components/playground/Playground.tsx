"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type AgentIdentity,
  type ChainVerification,
  type RegisterResult,
  type SessionLog,
  AnpClientError,
  ed25519Supported,
  generateIdentity,
  openSession,
  register,
  sendEvent,
  verifyLog,
} from "@/lib/anp";
import { ChainPanel } from "./ChainPanel";
import { OfferComposer } from "./OfferComposer";
import { formatErrors, validateEnvelope } from "./validation";

const DEFAULT_ENVELOPE = {
  party: "Acme Software",
  agent: { name: "Acme Selling Agent", declared_ai: true },
  may_discuss: ["renewal pricing", "term length", "payment terms"],
  may_disclose: ["list pricing", "standard discount bands"],
  will_not_disclose: ["floor pricing"],
  offer_authority: "propose_only",
  human_contact: "sales@acme.example",
};

const inputClass =
  "w-full rounded-md border border-line bg-canvas px-2.5 py-1.5 font-mono text-xs focus:border-accent";
const labelClass = "block text-[11px] font-medium text-muted";

/**
 * Flip one byte of a payload, locally: the first string leaf gets its first
 * character changed; failing that, the first number leaf gets incremented.
 */
function flipOneByte(payload: unknown): unknown {
  const clone = structuredClone(payload);
  let done = false;

  function walk(node: unknown, set: (v: unknown) => void) {
    if (done) return;
    if (typeof node === "string" && node.length > 0) {
      const flipped =
        String.fromCharCode(node.charCodeAt(0) === 122 ? 121 : node.charCodeAt(0) + 1) +
        node.slice(1);
      set(flipped);
      done = true;
      return;
    }
    if (typeof node === "number") {
      set(node + 1);
      done = true;
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, (v) => (node[i] = v)));
      return;
    }
    if (typeof node === "object" && node !== null) {
      for (const key of Object.keys(node)) {
        walk((node as Record<string, unknown>)[key], (v) => {
          (node as Record<string, unknown>)[key] = v;
        });
        if (done) return;
      }
    }
  }

  let result: unknown = clone;
  walk(clone, (v) => (result = v));
  return result;
}

function describeError(err: unknown): string {
  if (err instanceof AnpClientError) {
    return `The host refused the request: ${err.message} (${err.code}, HTTP ${err.status}).`;
  }
  if (err instanceof TypeError) {
    return "The request never reached the host. Check the buyer host URL, your network, and that the host allows this origin in its CORS policy.";
  }
  return err instanceof Error ? err.message : String(err);
}

function StepCard({
  step,
  title,
  state,
  children,
}: {
  step: number;
  title: string;
  state: "locked" | "active" | "done";
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`step-${step}`}
      className={`rounded-xl border p-5 ${
        state === "locked"
          ? "border-line opacity-55"
          : state === "done"
            ? "border-line bg-raised"
            : "border-accent/40 bg-raised"
      }`}
    >
      <h2 id={`step-${step}`} className="flex items-center gap-3 font-semibold">
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs ${
            state === "done"
              ? "bg-ok-soft text-ok"
              : state === "active"
                ? "bg-accent-soft text-accent-strong"
                : "bg-inset text-faint"
          }`}
        >
          {state === "done" ? "✓" : step}
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Playground({ defaultHost }: { defaultHost: string }) {
  const [host, setHost] = useState(defaultHost);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [identity, setIdentity] = useState<AgentIdentity | null>(null);
  const [registration, setRegistration] = useState<RegisterResult | null>(null);
  const [agentName, setAgentName] = useState("Acme Selling Agent");
  const [vendorName, setVendorName] = useState("Acme Software");
  const [contactEmail, setContactEmail] = useState("agents@acme.example");
  const [envelopeText, setEnvelopeText] = useState(
    JSON.stringify(DEFAULT_ENVELOPE, null, 2),
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [log, setLog] = useState<SessionLog | null>(null);
  const [verification, setVerification] = useState<ChainVerification | null>(
    null,
  );
  const [tamperedSeq, setTamperedSeq] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    ed25519Supported().then(setSupported);
  }, []);

  // Parse and validate the envelope draft live.
  const envelope = useMemo(() => {
    try {
      return { value: JSON.parse(envelopeText) as unknown, parseError: null };
    } catch (err) {
      return { value: null, parseError: (err as Error).message };
    }
  }, [envelopeText]);
  const envelopeErrors = useMemo(() => {
    if (envelope.parseError) return [`not valid JSON: ${envelope.parseError}`];
    if (validateEnvelope(envelope.value)) return [];
    return formatErrors(validateEnvelope.errors);
  }, [envelope]);

  // The log shown and verified: pristine, or with one payload byte flipped.
  const displayedLog = useMemo(() => {
    if (!log) return null;
    if (tamperedSeq === null) return log;
    const clone = structuredClone(log);
    const event = clone.events.find((e) => e.seq === tamperedSeq);
    if (event) event.payload = flipOneByte(event.payload);
    return clone;
  }, [log, tamperedSeq]);

  const runVerification = useCallback(async () => {
    if (!displayedLog) {
      setVerification(null);
      return;
    }
    setVerifying(true);
    try {
      const extraKeys = identity
        ? { [identity.fingerprint]: identity.publicKey }
        : undefined;
      setVerification(await verifyLog(displayedLog, { keys: extraKeys }));
    } finally {
      setVerifying(false);
    }
  }, [displayedLog, identity]);

  // Verify live after every append and after tampering.
  useEffect(() => {
    void runVerification();
  }, [runVerification]);

  const act = useCallback(
    async (name: string, fn: () => Promise<void>) => {
      setBusy(name);
      setError(null);
      try {
        await fn();
      } catch (err) {
        setError(describeError(err));
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const onGenerate = () =>
    act("generate", async () => {
      setIdentity(await generateIdentity());
      setRegistration(null);
      setSessionId(null);
      setLog(null);
      setTamperedSeq(null);
    });

  const onRegister = () =>
    act("register", async () => {
      if (!identity) return;
      setRegistration(
        await register(host, identity, {
          agent_name: agentName,
          vendor_name: vendorName,
          contact_email: contactEmail,
        }),
      );
    });

  const onOpenSession = () =>
    act("session", async () => {
      if (!identity || envelope.value === null) return;
      const opened = await openSession(host, identity, envelope.value, {
        sandbox: true,
      });
      setSessionId(opened.sessionId);
      setLog(opened.log);
      setTamperedSeq(null);
    });

  const onSendEvent = (kind: string, payload: unknown) =>
    act("event", async () => {
      if (!identity || !sessionId) return;
      setLog(await sendEvent(host, identity, sessionId, kind, payload));
      setTamperedSeq(null);
    });

  const onToggleTamper = () => {
    if (!log || log.events.length === 0) return;
    if (tamperedSeq !== null) {
      setTamperedSeq(null);
      return;
    }
    // Tamper the most interesting event: the latest offer or counter offer,
    // else the latest event.
    const target =
      [...log.events]
        .reverse()
        .find((e) => e.kind === "offer" || e.kind === "counter_offer") ??
      log.events[log.events.length - 1];
    setTamperedSeq(target.seq);
  };

  if (supported === false) {
    return (
      <div className="rounded-xl border border-warn/50 bg-raised p-6">
        <h2 className="font-semibold">This browser cannot run the playground</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          The playground signs every request with an Ed25519 key generated by
          your browser&rsquo;s WebCrypto implementation, and this browser does
          not support Ed25519 in WebCrypto. Recent versions of Chrome, Edge,
          Firefox, and Safari all do. The rest of the site works fine here.
        </p>
      </div>
    );
  }

  const identityDone = identity !== null;
  const registerDone = registration !== null;
  const sessionDone = sessionId !== null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
      <div className="space-y-4">
        {/* Host config */}
        <div className="rounded-xl border border-line bg-raised p-5">
          <label htmlFor="host" className={labelClass}>
            buyer host base URL
          </label>
          <input
            id="host"
            className={`${inputClass} mt-1`}
            value={host}
            onChange={(e) => setHost(e.target.value)}
            spellCheck={false}
          />
          <p className="mt-2 text-xs leading-relaxed text-muted">
            The playground talks to this host directly from your browser, so
            the host must allow this origin in its CORS policy. The sandbox
            buyer is deterministic and free to use.
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-bad/50 bg-bad-soft p-4 text-sm leading-relaxed"
          >
            {error}
          </div>
        ) : null}

        {/* Step 1: identity */}
        <StepCard
          step={1}
          title="Identity"
          state={identityDone ? "done" : "active"}
        >
          <p className="text-sm leading-relaxed text-muted">
            An agent identity is a raw 32-byte Ed25519 public key. Generate
            one in your browser; the keys live in memory only and never leave
            your browser except the public half.
          </p>
          <button
            type="button"
            onClick={onGenerate}
            disabled={busy !== null || supported === null}
            className="mt-3 rounded-md bg-accent px-4 py-2 text-xs font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy === "generate"
              ? "Generating…"
              : identityDone
                ? "Generate a new keypair"
                : "Generate keypair"}
          </button>
          {identity ? (
            <dl className="mt-4 space-y-2">
              <div>
                <dt className={labelClass}>public key (base64url)</dt>
                <dd className="hash-mono mt-0.5">{identity.publicKey}</dd>
              </div>
              <div>
                <dt className={labelClass}>fingerprint (sha-256)</dt>
                <dd className="hash-mono mt-0.5 text-accent-strong">
                  {identity.fingerprint}
                </dd>
              </div>
            </dl>
          ) : null}
        </StepCard>

        {/* Step 2: register */}
        <StepCard
          step={2}
          title="Register"
          state={registerDone ? "done" : identityDone ? "active" : "locked"}
        >
          <p className="text-sm leading-relaxed text-muted">
            Registration sends the public key with a proof of possession: an
            Ed25519 signature over{" "}
            <span className="font-mono text-xs">
              ANP/0.1\nregister\n&lt;public_key&gt;
            </span>
            . Unverified agents get sandbox access.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="reg-agent" className={labelClass}>
                agent_name
              </label>
              <input
                id="reg-agent"
                className={inputClass}
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="reg-vendor" className={labelClass}>
                vendor_name
              </label>
              <input
                id="reg-vendor"
                className={inputClass}
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="reg-email" className={labelClass}>
                contact_email
              </label>
              <input
                id="reg-email"
                className={inputClass}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onRegister}
            disabled={!identityDone || busy !== null}
            className="mt-3 rounded-md bg-accent px-4 py-2 text-xs font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy === "register" ? "Registering…" : "Sign proof and register"}
          </button>
          {registration ? (
            <dl className="mt-4 space-y-2">
              <div>
                <dt className={labelClass}>agent id</dt>
                <dd className="hash-mono mt-0.5">{registration.agentId}</dd>
              </div>
              <div>
                <dt className={labelClass}>status</dt>
                <dd className="mt-0.5">
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent-strong">
                    {registration.status}
                  </span>
                </dd>
              </div>
            </dl>
          ) : null}
        </StepCard>

        {/* Step 3: open a session */}
        <StepCard
          step={3}
          title="Open a session"
          state={sessionDone ? "done" : registerDone ? "active" : "locked"}
        >
          <p className="text-sm leading-relaxed text-muted">
            Declare your vendor mandate envelope, validated live against{" "}
            <span className="font-mono text-xs">envelope.schema.json</span>.
            The request is signed per section 3 of the spec; the sandbox
            buyer answers with its own envelope.
          </p>
          <label htmlFor="envelope" className={`${labelClass} mt-3`}>
            vendor mandate envelope
          </label>
          <textarea
            id="envelope"
            rows={12}
            spellCheck={false}
            className={`${inputClass} mt-1 leading-relaxed`}
            value={envelopeText}
            onChange={(e) => setEnvelopeText(e.target.value)}
          />
          {envelopeErrors.length > 0 ? (
            <ul
              className="mt-2 space-y-1 rounded-md border border-bad/40 bg-bad-soft p-3 font-mono text-[11px] text-bad"
              aria-live="polite"
            >
              {envelopeErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 font-mono text-[11px] text-ok" aria-live="polite">
              valid against envelope.schema.json
            </p>
          )}
          <button
            type="button"
            onClick={onOpenSession}
            disabled={
              !registerDone || envelopeErrors.length > 0 || busy !== null
            }
            className="mt-3 rounded-md bg-accent px-4 py-2 text-xs font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy === "session"
              ? "Opening…"
              : sessionDone
                ? "Open another sandbox session"
                : "Open sandbox session"}
          </button>
          {sessionId ? (
            <p className="mt-3 font-mono text-xs text-muted">
              session <span className="text-fg">{sessionId}</span>
            </p>
          ) : null}
        </StepCard>

        {/* Step 4: negotiate */}
        <StepCard
          step={4}
          title="Negotiate"
          state={sessionDone ? "active" : "locked"}
        >
          <p className="mb-4 text-sm leading-relaxed text-muted">
            Compose an offer, validated against{" "}
            <span className="font-mono text-xs">offer.schema.json</span>, or
            send free text. Every event you submit is signed with the
            authorship signature{" "}
            <span className="font-mono text-xs">
              ANP/0.1\n&lt;kind&gt;\n&lt;payload_hash&gt;
            </span>
            ; the sandbox buyer&rsquo;s counters appear in the chain as they
            come back.
          </p>
          {sessionDone ? (
            <OfferComposer
              onSendOffer={(payload) => onSendEvent("offer", payload)}
              onSendMessage={(body) => onSendEvent("message", { body })}
              busy={busy === "event"}
            />
          ) : (
            <p className="text-xs text-faint">
              Open a session to start negotiating.
            </p>
          )}
        </StepCard>
      </div>

      {/* The chain panel */}
      <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
        <ChainPanel
          log={displayedLog}
          verification={verification}
          tamperedSeq={tamperedSeq}
          onToggleTamper={onToggleTamper}
          onVerify={() => void runVerification()}
          verifying={verifying}
        />
      </div>
    </div>
  );
}
