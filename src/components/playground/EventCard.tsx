"use client";

import type { AnpEvent, EventVerification } from "@/lib/anp";

function Hash({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 font-mono text-[11px] leading-5 text-faint">
        {label}
      </dt>
      <dd
        className={`hash-mono leading-5 ${accent ? "text-accent-strong" : "text-muted"}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * One event in the chain panel: identity fields, hashes, collapsible
 * payload, and the live verification badge with per-check failures.
 */
export function EventCard({
  event,
  verification,
  tampered,
}: {
  event: AnpEvent;
  verification: EventVerification | undefined;
  tampered: boolean;
}) {
  const ok = verification?.ok ?? null;
  const failing = verification?.checks.filter((c) => !c.ok) ?? [];

  return (
    <li
      className={`rounded-lg border p-4 ${
        ok === false
          ? "border-bad/60 bg-bad-soft"
          : "border-line bg-inset"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-xs text-faint">seq {event.seq}</span>
        <span className="text-sm font-medium">{event.kind}</span>
        <span className="text-xs text-muted">{event.actor}</span>
        {tampered ? (
          <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-medium text-warn">
            tampered locally
          </span>
        ) : null}
        <span className="ml-auto">
          {ok === null ? (
            <span className="text-xs text-faint">unverified</span>
          ) : ok ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-medium text-ok">
              <span aria-hidden="true">✓</span> verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-bad-soft px-2 py-0.5 text-[11px] font-medium text-bad">
              <span aria-hidden="true">✕</span> fails
            </span>
          )}
        </span>
      </div>

      <details className="mt-3 group">
        <summary className="cursor-pointer select-none font-mono text-xs text-muted hover:text-fg">
          payload
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-canvas p-3 font-mono text-[11px] leading-relaxed">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      </details>

      <dl className="mt-3 space-y-1">
        <Hash label="payload_hash" value={event.payload_hash} />
        <Hash label="prev_hash" value={event.prev_hash} />
        <Hash label="event_hash" value={event.event_hash} accent />
        <Hash label="signer" value={event.signer ?? "(unsigned)"} />
      </dl>

      {failing.length > 0 ? (
        <div className="mt-3 space-y-2 rounded-md border border-bad/40 bg-canvas p-3">
          <p className="text-xs font-semibold text-bad">
            Failing checks
          </p>
          {failing.map((check) => (
            <div key={check.name} className="text-xs leading-relaxed">
              <p className="font-mono font-semibold">{check.name}</p>
              {check.detail ? (
                <p className="mt-0.5 text-muted">{check.detail}</p>
              ) : null}
              {check.expected && check.actual ? (
                <div className="mt-1 space-y-0.5">
                  <p className="hash-mono">
                    <span className="text-faint">declared </span>
                    {check.expected.slice(0, 32)}…
                  </p>
                  <p className="hash-mono">
                    <span className="text-faint">computed </span>
                    <span className="text-bad">{check.actual.slice(0, 32)}…</span>
                  </p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}
