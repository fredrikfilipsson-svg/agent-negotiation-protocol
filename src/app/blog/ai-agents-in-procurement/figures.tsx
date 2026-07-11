/**
 * Product "screenshots" for the prototype blog post, rendered as themed UI
 * mockups so they stay crisp at every size and track the site palette in
 * both color schemes. Swap for real captures before publishing.
 */

function BrowserFrame({
  url,
  caption,
  children,
}: {
  url: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-xl border border-line bg-raised shadow-sm">
        <div className="flex items-center gap-3 border-b border-line bg-inset px-4 py-2.5">
          <span aria-hidden="true" className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-bad/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-warn/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-ok/60" />
          </span>
          <span className="truncate rounded-md border border-line bg-canvas px-3 py-1 font-mono text-[0.6875rem] text-muted">
            {url}
          </span>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
      <figcaption className="mt-3 text-center text-sm text-muted">
        {caption}
      </figcaption>
    </figure>
  );
}

/* ---- Figure 1: live negotiation session --------------------------------- */

const SESSION_EVENTS = [
  {
    actor: "buyer.agent",
    side: "buyer",
    kind: "mandate",
    body: "May negotiate: price, payment terms, delivery. May disclose: target volume. Authority: up to $84,000 total, terms ≤ NET 45.",
    hash: "9f2c…a41d",
  },
  {
    actor: "vendor.agent",
    side: "vendor",
    kind: "offer",
    body: "1,200 × Model-C sensor @ $71.00 · NET 30 · delivery 6 weeks · expires in 48h",
    hash: "b7e0…3c92",
  },
  {
    actor: "buyer.agent",
    side: "buyer",
    kind: "counter_offer",
    body: "1,200 × Model-C sensor @ $66.50 · NET 45 · delivery 6 weeks · cites volume commitment",
    hash: "48aa…f7d1",
  },
  {
    actor: "vendor.agent",
    side: "vendor",
    kind: "offer",
    body: "1,200 × Model-C sensor @ $68.20 · NET 45 · delivery 5 weeks · expires in 24h",
    hash: "d15b…08ce",
  },
  {
    actor: "buyer.agent",
    side: "buyer",
    kind: "accept",
    body: "Accepted within mandate. Total $81,840 ≤ authority cap. Session sealed for review.",
    hash: "e93f…6b27",
  },
] as const;

export function NegotiationSessionFigure() {
  return (
    <BrowserFrame
      url="platform.anp.dev/sessions/ses_01j9…/live"
      caption="A live session: both agents declare mandates up front, then trade structured offers. Every event lands in the hash chain as it happens."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-mono text-[0.6875rem] text-accent-strong">
          session live
        </span>
        <span className="font-mono text-[0.6875rem] text-faint">
          ses_01j9k2 · ANP/0.1 · 7 events
        </span>
        <span className="ml-auto rounded-full bg-ok-soft px-2.5 py-0.5 font-mono text-[0.6875rem] text-ok">
          ⛓ chain intact
        </span>
      </div>
      <ol className="space-y-3">
        {SESSION_EVENTS.map((e) => (
          <li
            key={e.hash}
            className={`max-w-[92%] rounded-lg border border-line bg-inset p-3 sm:max-w-[80%] ${
              e.side === "buyer" ? "" : "ml-auto"
            }`}
          >
            <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
              <span
                className={`font-mono font-medium ${
                  e.side === "buyer" ? "text-accent-strong" : "text-fg"
                }`}
              >
                {e.actor}
              </span>
              <span className="text-faint">{e.kind}</span>
              <span className="ml-auto font-mono text-[0.625rem] text-faint">
                {e.hash}
              </span>
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {e.body}
            </p>
          </li>
        ))}
      </ol>
    </BrowserFrame>
  );
}

/* ---- Figure 2: offer analysis -------------------------------------------- */

const OFFER_ROUNDS = [
  { round: "Opening (vendor)", unit: "$71.00", term: "NET 30", total: "$85,200", delta: "—" },
  { round: "Counter (buyer)", unit: "$66.50", term: "NET 45", total: "$79,800", delta: "−6.3%" },
  { round: "Revised (vendor)", unit: "$68.20", term: "NET 45", total: "$81,840", delta: "−3.9%" },
] as const;

export function OfferAnalysisFigure() {
  return (
    <BrowserFrame
      url="platform.anp.dev/sessions/ses_01j9…/offers"
      caption="Offers are strict JSON, so the platform compares rounds mechanically and flags exactly what moved between them."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-sm">
          <thead>
            <tr className="text-left text-[0.6875rem] uppercase tracking-wider text-muted">
              <th className="border-b border-line pb-2 pr-4 font-semibold">Round</th>
              <th className="border-b border-line pb-2 pr-4 font-semibold">Unit price</th>
              <th className="border-b border-line pb-2 pr-4 font-semibold">Terms</th>
              <th className="border-b border-line pb-2 pr-4 font-semibold">Total</th>
              <th className="border-b border-line pb-2 font-semibold">vs opening</th>
            </tr>
          </thead>
          <tbody>
            {OFFER_ROUNDS.map((r) => (
              <tr key={r.round}>
                <td className="border-b border-line py-2.5 pr-4 font-medium">{r.round}</td>
                <td className="border-b border-line py-2.5 pr-4 font-mono text-[0.8125rem]">{r.unit}</td>
                <td className="border-b border-line py-2.5 pr-4 text-muted">{r.term}</td>
                <td className="border-b border-line py-2.5 pr-4 font-mono text-[0.8125rem]">{r.total}</td>
                <td
                  className={`border-b border-line py-2.5 font-mono text-[0.8125rem] ${
                    r.delta === "—" ? "text-faint" : "text-ok"
                  }`}
                >
                  {r.delta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 rounded-lg border border-line bg-accent-soft/50 p-3.5">
        <p className="font-mono text-[0.6875rem] uppercase tracking-widest text-accent">
          Agent insight
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Final offer lands 3.9% under opening and inside your mandate cap of
          $84,000. Payment terms improved from NET 30 to NET 45; delivery
          shortened by one week. Recommended: accept.
        </p>
      </div>
    </BrowserFrame>
  );
}

/* ---- Figure 3: verified session log -------------------------------------- */

const LOG_ROWS = [
  { seq: 4, kind: "counter_offer", prev: "b7e0c19a3c92…", hash: "48aa02d5f7d1…" },
  { seq: 5, kind: "offer", prev: "48aa02d5f7d1…", hash: "d15b7e4008ce…" },
  { seq: 6, kind: "accept", prev: "d15b7e4008ce…", hash: "e93f11c86b27…" },
] as const;

export function VerifiedLogFigure() {
  return (
    <BrowserFrame
      url="platform.anp.dev/sessions/ses_01j9…/log"
      caption="After the session, either side re-verifies the full log independently. Change one byte anywhere and the chain breaks visibly."
    >
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-line bg-ok-soft px-4 py-3">
        <span aria-hidden="true" className="text-lg text-ok">
          ✓
        </span>
        <div>
          <p className="text-sm font-semibold text-ok">
            Chain verified · 7 of 7 events
          </p>
          <p className="text-xs text-muted">
            Signatures valid · hashes contiguous · re-verified just now by
            buyer.agent
          </p>
        </div>
      </div>
      <ol className="space-y-2.5">
        {LOG_ROWS.map((row) => (
          <li key={row.seq} className="rounded-lg border border-line bg-inset p-3.5">
            <p className="flex flex-wrap items-baseline gap-x-3 text-sm">
              <span className="font-mono text-faint">seq {row.seq}</span>
              <span className="font-medium">{row.kind}</span>
            </p>
            <dl className="mt-2 space-y-1">
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 font-mono text-xs text-faint">prev_hash</dt>
                <dd className="hash-mono text-muted">{row.prev}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 font-mono text-xs text-faint">event_hash</dt>
                <dd className="hash-mono text-accent-strong">{row.hash}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </BrowserFrame>
  );
}
