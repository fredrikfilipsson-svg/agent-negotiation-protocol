import Link from "next/link";
import { Code } from "@/components/Code";
import { readExampleLog } from "@/lib/protocol";
import { GITHUB_REPO_URL, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  alternateName: "ANP",
  url: SITE_URL,
  description: SITE_TAGLINE,
  sameAs: [GITHUB_REPO_URL],
};

const GUARANTEES = [
  {
    title: "Authenticated identity",
    body: "Every request is signed with a registered Ed25519 key. There are no anonymous participants, and every agent declares that it is an AI.",
  },
  {
    title: "Mandate exchange",
    body: "Each side opens by declaring what its agent may discuss, what it may disclose, and what authority it carries. Overreach becomes provable from the log.",
  },
  {
    title: "Structured offers",
    body: "Offers and counter-offers are strict JSON with line items, quantities, unit prices, term and expiry, so both sides can parse, compare, and audit them mechanically.",
  },
  {
    title: "A verifiable log",
    body: "Every event appends to a SHA-256 hash chain. Either side can re-verify the whole log at any time; neither side, including the host, can rewrite history undetected.",
  },
] as const;

export default function HomePage() {
  const log = JSON.parse(readExampleLog()) as {
    events: Array<{
      seq: number;
      actor: string;
      kind: string;
      payload: unknown;
      prev_hash: string;
      event_hash: string;
    }>;
  };
  const offerEvent = log.events.find((e) => e.kind === "offer");
  const offerJson = JSON.stringify(offerEvent?.payload, null, 2);
  const chainFragment = log.events.slice(1);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      {/* Hero */}
      <section className="py-16 sm:py-24">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">
          ANP/0.1 · an open protocol · MIT
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          AI agents negotiating commercial terms, on a record both sides can
          verify.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          ANP lets a vendor&rsquo;s selling agent and a buyer&rsquo;s
          negotiation agent conduct a negotiation over HTTPS with signed
          identity, an explicit mandate exchange, structured offers, and a
          hash chained session log that neither side can rewrite undetected.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/spec"
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90"
          >
            Read the spec
          </Link>
          <Link
            href="/playground"
            className="rounded-lg border border-line-strong px-5 py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            Try the sandbox
          </Link>
          <Link
            href="/sdk"
            className="rounded-lg border border-line-strong px-5 py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            Implement it
          </Link>
        </div>
      </section>

      {/* Four guarantees */}
      <section aria-labelledby="guarantees" className="border-t border-line py-16">
        <h2 id="guarantees" className="text-2xl font-semibold tracking-tight">
          Four guarantees
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          The protocol is a transport, not a policy engine. It never expands an
          agent&rsquo;s authority; it makes what each agent does auditable.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {GUARANTEES.map((g, i) => (
            <div
              key={g.title}
              className="rounded-xl border border-line bg-raised p-6"
            >
              <p className="font-mono text-xs text-accent">0{i + 1}</p>
              <h3 className="mt-2 font-semibold">{g.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {g.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Offer + chain */}
      <section
        aria-labelledby="on-the-wire"
        className="border-t border-line py-16"
      >
        <h2 id="on-the-wire" className="text-2xl font-semibold tracking-tight">
          What it looks like on the wire
        </h2>
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-2">
          <div>
            <h3 className="font-semibold">A structured offer</h3>
            <p className="mt-2 text-sm text-muted">
              Event 3 of the{" "}
              <Link href="/schemas" className="text-accent underline underline-offset-4">
                bundled example session
              </Link>
              . Strict schema, unknown keys rejected, required expiry so
              nothing dangles.
            </p>
            <div className="mt-4 text-sm">
              <Code code={offerJson} lang="json" />
            </div>
          </div>
          <div>
            <h3 className="font-semibold">The hash chain</h3>
            <p className="mt-2 text-sm text-muted">
              Every event binds to its predecessor. Change one byte anywhere
              and every verifier sees exactly where the chain broke.
            </p>
            <ol className="mt-4 space-y-3">
              {chainFragment.map((event) => (
                <li
                  key={event.seq}
                  className="rounded-lg border border-line bg-inset p-4"
                >
                  <p className="flex flex-wrap items-baseline gap-x-3 text-sm">
                    <span className="font-mono text-faint">
                      seq {event.seq}
                    </span>
                    <span className="font-medium">{event.kind}</span>
                    <span className="text-xs text-muted">{event.actor}</span>
                  </p>
                  <dl className="mt-2 space-y-1">
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 font-mono text-xs text-faint">
                        prev_hash
                      </dt>
                      <dd className="hash-mono text-muted">
                        {event.prev_hash.slice(0, 24)}…
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 font-mono text-xs text-faint">
                        event_hash
                      </dt>
                      <dd className="hash-mono text-accent-strong">
                        {event.event_hash.slice(0, 24)}…
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted">
              Each <span className="font-mono">prev_hash</span> equals the
              previous <span className="font-mono">event_hash</span>. Verify
              this chain yourself in the{" "}
              <Link
                href="/playground"
                className="text-accent underline underline-offset-4"
              >
                playground
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="border-t border-line py-16 text-center">
        <blockquote className="mx-auto max-w-2xl text-xl font-medium leading-relaxed">
          An open standard with many implementations beats a proprietary
          channel with one.
        </blockquote>
        <p className="mt-4 text-sm text-muted">
          MIT licensed. Anyone, including competitors, may implement ANP
          without permission.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/implementations"
            className="rounded-lg border border-line-strong px-5 py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            See implementations
          </Link>
          <Link
            href="/governance"
            className="rounded-lg border border-line-strong px-5 py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            Governance
          </Link>
        </div>
      </section>
    </div>
  );
}
