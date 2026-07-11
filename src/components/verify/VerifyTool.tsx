"use client";

import { useCallback, useRef, useState } from "react";
import {
  type ChainVerification,
  type SessionLog,
  verifyLog,
} from "@/lib/anp";
import { EventCard } from "@/components/playground/EventCard";

interface VerifyState {
  log: SessionLog;
  verification: ChainVerification;
  source: string;
}

/**
 * Standalone verifier: paste or drop any ANP/0.1 session log document and
 * get the full per-event, per-check verdict, computed entirely in the
 * browser. Nothing is uploaded anywhere.
 */
export function VerifyTool() {
  const [state, setState] = useState<VerifyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const runVerification = useCallback(async (text: string, source: string) => {
    setBusy(true);
    setError(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw new Error(`not valid JSON: ${(err as Error).message}`);
      }
      const log = parsed as SessionLog;
      if (!Array.isArray(log.events)) {
        throw new Error(
          'this JSON has no "events" array; expected a session log document as returned by GET .../log',
        );
      }
      if (typeof log.session?.id !== "string") {
        throw new Error(
          'this JSON has no "session.id"; the session id is part of every event hash, so verification needs it',
        );
      }
      setState({ log, verification: await verifyLog(log), source });
    } catch (err) {
      setState(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      const text = await file.text();
      if (textRef.current) textRef.current.value = text;
      await runVerification(text, file.name);
    },
    [runVerification],
  );

  const loadExample = useCallback(async () => {
    const res = await fetch("/schemas/session-log.example.json");
    const text = await res.text();
    if (textRef.current) textRef.current.value = text;
    await runVerification(text, "session-log.example.json");
  }, [runVerification]);

  const downloadReport = useCallback(() => {
    if (!state) return;
    const report = {
      tool: "anp.dev log verifier",
      verified_at: new Date().toISOString(),
      session_id: state.log.session.id,
      source: state.source,
      chain_head:
        state.log.events[state.log.events.length - 1]?.event_hash ?? null,
      result: state.verification,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anp-verification-${state.log.session.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const verdict = state?.verification;

  return (
    <div className="mt-10 grid items-start gap-6 lg:grid-cols-2">
      <div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
            dragOver ? "border-accent bg-accent-soft" : "border-line"
          }`}
        >
          <label
            htmlFor="log-input"
            className="block text-[11px] font-medium text-muted"
          >
            session log JSON (paste, or drop a file anywhere in this box)
          </label>
          <textarea
            id="log-input"
            ref={textRef}
            rows={16}
            spellCheck={false}
            placeholder='{ "protocol": "ANP/0.1", "session": { "id": "…" }, "keys": { … }, "events": [ … ] }'
            className="mt-2 w-full rounded-md border border-line bg-canvas px-3 py-2 font-mono text-xs leading-relaxed focus:border-accent"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void runVerification(textRef.current?.value ?? "", "pasted JSON")
            }
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void loadExample()}
            className="rounded-lg border border-line-strong px-5 py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Load the example log
          </button>
          {state ? (
            <button
              type="button"
              onClick={downloadReport}
              className="rounded-lg border border-line-strong px-5 py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
            >
              Download report
            </button>
          ) : null}
        </div>
        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-md border border-bad/40 bg-bad-soft p-3 font-mono text-xs text-bad"
          >
            {error}
          </p>
        ) : null}
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Verification runs the section 4 rules: contiguous sequence numbers,
          payload hashes over canonical JSON, chain linkage, event hash
          recomputation, and Ed25519 authorship signatures against the keys
          published in the log&rsquo;s <span className="font-mono">keys</span>{" "}
          block. The log never leaves this page.
        </p>
      </div>

      <div>
        {verdict && state ? (
          <section aria-label="Verification result">
            <div
              role="status"
              className={`rounded-xl border p-5 ${
                verdict.ok
                  ? "border-ok/40 bg-ok-soft"
                  : "border-bad/40 bg-bad-soft"
              }`}
            >
              <p className="font-mono text-sm font-semibold">
                {verdict.ok
                  ? `${verdict.verifiedCount} of ${verdict.eventCount} events verify. The chain holds.`
                  : `${verdict.verifiedCount} of ${verdict.eventCount} events verify. This log does not hold.`}
              </p>
              <p className="mt-1 text-xs text-muted">
                session {state.log.session.id} · {state.source}
              </p>
              {verdict.problems.length > 0 ? (
                <ul className="mt-3 space-y-1 text-xs text-bad">
                  {verdict.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
              {!verdict.ok ? (
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  A broken chain is a disputed session under the spec: stop
                  relying on this log and involve a human on both sides.
                </p>
              ) : null}
            </div>
            <ol className="mt-4 space-y-3">
              {state.log.events.map((event) => (
                <EventCard
                  key={`${event.seq}-${event.event_hash}`}
                  event={event}
                  verification={verdict.events.find(
                    (e) => e.seq === event.seq,
                  )}
                  tampered={false}
                />
              ))}
            </ol>
          </section>
        ) : (
          <div className="rounded-xl border border-line bg-raised p-6 text-sm leading-relaxed text-muted">
            <p>
              The verdict appears here: one card per event with its hashes,
              signer, and every check that passed or failed.
            </p>
            <p className="mt-3">
              Try it with the published example log, a log exported from the
              playground, or a log your own implementation produced.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
