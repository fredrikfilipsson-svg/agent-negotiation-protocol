"use client";

import { useState } from "react";
import type { ChainVerification, SessionLog } from "@/lib/anp";
import { EventCard } from "./EventCard";

/**
 * The always-visible right panel: every event as a card with its hashes and
 * a live verification badge, a Verify entire chain button, and the Tamper
 * teaching toggle.
 */
export function ChainPanel({
  log,
  verification,
  tamperedSeq,
  onToggleTamper,
  onVerify,
  verifying,
}: {
  log: SessionLog | null;
  verification: ChainVerification | null;
  tamperedSeq: number | null;
  onToggleTamper: () => void;
  onVerify: () => void;
  verifying: boolean;
}) {
  const [celebrate, setCelebrate] = useState(false);

  const allGreen =
    verification !== null &&
    verification.ok &&
    verification.eventCount > 0;

  return (
    <section
      aria-label="Session chain"
      className="flex h-full min-h-0 flex-col rounded-xl border border-line bg-raised"
    >
      <div className="border-b border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">The chain</h2>
          {verification ? (
            <p
              className={`font-mono text-xs ${
                allGreen ? "text-ok" : "text-bad"
              }`}
              role="status"
            >
              {verification.verifiedCount} of {verification.eventCount} events
              verify
            </p>
          ) : (
            <p className="font-mono text-xs text-faint">no session yet</p>
          )}
        </div>

        {log ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  onVerify();
                  setCelebrate(true);
                  window.setTimeout(() => setCelebrate(false), 1000);
                }}
                disabled={verifying}
                className={`rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50 ${
                  celebrate && allGreen ? "chain-celebrate" : ""
                }`}
              >
                {verifying ? "Verifying…" : "Verify entire chain"}
              </button>
              <button
                type="button"
                onClick={onToggleTamper}
                aria-pressed={tamperedSeq !== null}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  tamperedSeq !== null
                    ? "border-warn/60 bg-warn/15 text-warn"
                    : "border-line-strong text-muted hover:border-warn/60 hover:text-warn"
                }`}
              >
                {tamperedSeq !== null ? "Undo tamper" : "Tamper"}
              </button>
            </div>

            {verification && allGreen && verification.eventCount >= 12 ? (
              <p className="mt-3 text-xs text-ok" role="status">
                {verification.verifiedCount} of {verification.eventCount}.
                Every hash recomputes, every signature verifies. The chain
                holds.
              </p>
            ) : null}

            {tamperedSeq !== null ? (
              <p className="mt-3 text-xs leading-relaxed text-muted">
                One byte of event {tamperedSeq}&rsquo;s payload was flipped,
                locally only. The payload no longer hashes to its declared{" "}
                <span className="font-mono">payload_hash</span>, so that
                check fails. Note what still passes: the chain linkage and
                the signature over the declared hash. The log proves the
                original payload was signed; it cannot be made to vouch for
                the altered one.
              </p>
            ) : null}

            {verification && verification.problems.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-bad">
                {verification.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Open a session and every event will appear here with its hashes,
            its authorship signature, and a live verification badge.
          </p>
        )}
      </div>

      <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {(log?.events ?? []).map((event) => (
          <EventCard
            key={event.seq}
            event={event}
            verification={verification?.events.find(
              (e) => e.seq === event.seq,
            )}
            tampered={tamperedSeq === event.seq}
          />
        ))}
      </ol>
    </section>
  );
}
