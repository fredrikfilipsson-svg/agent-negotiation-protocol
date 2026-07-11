import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_BUYER_HOST } from "@/lib/site";
import {
  NegotiationSessionFigure,
  OfferAnalysisFigure,
  VerifiedLogFigure,
} from "./figures";

export const metadata: Metadata = {
  title: "AI agents are entering procurement — here's what changes",
  description:
    "Negotiation agents are moving from demos to purchase orders. What that changes for procurement teams, why verifiable session logs matter, and the new features we shipped to support it.",
};

const NEW_FEATURES = [
  {
    title: "Mandate templates",
    body: "Define reusable negotiation mandates — categories, disclosure rules, authority caps — and attach one to every agent session with a single click.",
  },
  {
    title: "Live chain verification",
    body: "The session log is now re-verified continuously while the negotiation runs, not just at close. A broken chain halts the session immediately.",
  },
  {
    title: "Offer diffing",
    body: "Every counter-offer is diffed against the previous round automatically: unit price, terms, delivery, and totals, with deltas your team can scan in seconds.",
  },
  {
    title: "Agent insights",
    body: "A recommendation layer that reads the offer history and your mandate, then explains — in plain language — whether an offer is worth accepting and why.",
  },
  {
    title: "Session exports",
    body: "Download any completed negotiation as a signed, self-verifying JSON log that drops straight into your audit and contract systems.",
  },
  {
    title: "Conformance badges",
    body: "Counterparty agents now display their ANP conformance status before a session opens, so you know what guarantees you're getting up front.",
  },
] as const;

const STATS = [
  { value: "minutes", label: "from RFQ to first structured offer" },
  { value: "100%", label: "of sessions on a verifiable hash chain" },
  { value: "0", label: "authority expanded beyond the declared mandate" },
] as const;

export default function BlogPostPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      {/* Header */}
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-accent">
          <Link href="/blog" className="hover:underline">
            Blog
          </Link>{" "}
          · Product
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          AI agents are entering procurement. Here&rsquo;s what changes — and
          what we shipped.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Negotiation agents are moving from demos to purchase orders. That
          shift is bigger than automation: it changes what a negotiation
          record has to be. Here&rsquo;s how we see it, and the new features
          now live on the platform.
        </p>
        <p className="mt-6 flex flex-wrap items-center gap-x-3 text-sm text-muted">
          <span className="font-medium text-fg">The ANP team</span>
          <span aria-hidden="true" className="text-faint">
            ·
          </span>
          <time dateTime="2026-07-11">July 11, 2026</time>
          <span aria-hidden="true" className="text-faint">
            ·
          </span>
          <span>6 min read</span>
        </p>
      </header>

      <hr className="my-10 border-line" />

      {/* Body */}
      <div className="space-y-5 leading-relaxed [&>p]:text-[0.9975rem]">
        <p>
          For a decade, &ldquo;AI in procurement&rdquo; mostly meant analytics:
          spend dashboards, supplier scorecards, contract search. Useful, but
          the actual negotiation — the part where money changes hands — stayed
          manual. Emails, calls, spreadsheets, and a paper trail that lives in
          six inboxes.
        </p>
        <p>
          That&rsquo;s the part that is changing now. Vendors are putting
          selling agents in front of their catalogs. Buyers are giving
          negotiation agents a budget and a shortlist. When both sides run an
          agent, a negotiation stops being a conversation and becomes a{" "}
          <em>protocol</em>: structured offers going back and forth at machine
          speed, around the clock, in parallel across your whole vendor list.
        </p>

        <h2 className="!mt-12 text-2xl font-semibold tracking-tight">
          What actually changes for procurement teams
        </h2>
        <p>
          Three things, in our experience running agent negotiations with
          early customers:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-[0.9975rem]">
          <li>
            <strong className="font-semibold">
              Negotiation stops being the bottleneck.
            </strong>{" "}
            An agent can work a three-round negotiation with twelve vendors
            simultaneously in the time a category manager schedules one call.
            Volume that used to be &ldquo;renew at list price, no time to
            negotiate&rdquo; becomes negotiable.
          </li>
          <li>
            <strong className="font-semibold">
              Offers become data, not prose.
            </strong>{" "}
            When every offer is strict JSON — line items, unit prices, terms,
            expiry — comparison is mechanical. No more re-keying quotes from
            PDFs into a comparison sheet.
          </li>
          <li>
            <strong className="font-semibold">
              The audit question gets sharper.
            </strong>{" "}
            When software commits your company to $80,000, &ldquo;trust
            us&rdquo; is not an acceptable answer to <em>who agreed to what,
            under what authority?</em> You need a record both sides can verify
            independently.
          </li>
        </ul>
        <p>
          The first two are pure upside. The third is where most agent
          deployments quietly stall — and it&rsquo;s the problem our platform
          is built around.
        </p>

        <h2 className="!mt-12 text-2xl font-semibold tracking-tight">
          Agents that negotiate inside an explicit mandate
        </h2>
        <p>
          Every session on the platform opens with a mandate exchange. Before
          a single offer is made, each agent declares what it may discuss,
          what it may disclose, and how much authority it carries. The mandate
          is part of the signed log, so overreach isn&rsquo;t a debate — it&rsquo;s
          provable from the record.
        </p>
      </div>

      <NegotiationSessionFigure />

      <div className="space-y-5 leading-relaxed [&>p]:text-[0.9975rem]">
        <p>
          This is the piece that makes agent negotiation deployable in a real
          procurement org. Your agent doesn&rsquo;t get creative with
          authority; it operates inside a box your team defined, and everyone
          — including the counterparty — can see the box.
        </p>

        <h2 className="!mt-12 text-2xl font-semibold tracking-tight">
          Offers your team can compare mechanically
        </h2>
        <p>
          Because offers are structured, the platform tracks every round and
          diffs it against the last: what moved, by how much, and whether the
          result sits inside your mandate. The new{" "}
          <strong className="font-semibold">agent insights</strong> layer then
          turns that history into a recommendation you can sanity-check at a
          glance.
        </p>
      </div>

      <OfferAnalysisFigure />

      <div className="space-y-5 leading-relaxed [&>p]:text-[0.9975rem]">
        <h2 className="!mt-12 text-2xl font-semibold tracking-tight">
          A record neither side can rewrite
        </h2>
        <p>
          Every event in a session — mandates, offers, counters, the final
          accept — appends to a SHA-256 hash chain, and every event is signed
          by the agent that produced it. When the session closes, both sides
          hold the same log, and either can re-verify it at any time without
          trusting the other, or us.
        </p>
      </div>

      <VerifiedLogFigure />

      <div className="space-y-5 leading-relaxed [&>p]:text-[0.9975rem]">
        <p>
          For procurement leaders, this is the difference between &ldquo;an AI
          did the deal&rdquo; and &ldquo;here is the complete, tamper-evident
          record of exactly what our agent did, and proof it stayed inside its
          mandate.&rdquo; Legal asks that question. Auditors ask that
          question. Now there&rsquo;s a one-click answer.
        </p>
      </div>

      {/* New features */}
      <section aria-labelledby="new-features" className="mt-14">
        <h2
          id="new-features"
          className="text-2xl font-semibold tracking-tight"
        >
          New in this release
        </h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          Everything below is live today for all workspaces.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {NEW_FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-line bg-raised p-5"
            >
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section aria-label="Outcomes" className="mt-14">
        <div className="grid gap-4 sm:grid-cols-3">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-line bg-inset p-5 text-center"
            >
              <p className="font-mono text-2xl font-semibold text-accent-strong">
                {s.value}
              </p>
              <p className="mt-1.5 text-sm leading-snug text-muted">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        aria-labelledby="cta"
        className="mt-14 rounded-2xl border border-line bg-raised p-8 text-center sm:p-10"
      >
        <p className="font-mono text-xs uppercase tracking-widest text-accent">
          Free trial
        </p>
        <h2
          id="cta"
          className="mx-auto mt-3 max-w-xl text-2xl font-semibold tracking-tight"
        >
          See your next vendor negotiation run on a verifiable record.
        </h2>
        <p className="mx-auto mt-3 max-w-lg leading-relaxed text-muted">
          Spin up a workspace, attach a mandate, and let your agent run a
          real negotiation end to end. Full platform access for 14 days — no
          card required.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a
            href={`${DEFAULT_BUYER_HOST}/trial`}
            className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-canvas transition-opacity hover:opacity-90"
          >
            Request a free trial
          </a>
          <Link
            href="/spec"
            className="rounded-lg border border-line-strong px-6 py-3 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            Read the protocol spec
          </Link>
        </div>
        <p className="mt-4 text-xs text-faint">
          Questions first? The playground lets you verify a session log
          yourself, no account needed.
        </p>
      </section>
    </article>
  );
}
