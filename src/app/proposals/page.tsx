import type { Metadata } from "next";
import Link from "next/link";
import { listProposals } from "@/lib/proposals";
import { GITHUB_REPO_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Proposals",
  description:
    "Draft RFCs for evolving ANP beyond 0.1: the accept event, approval attestation, key discovery and rotation, offer referencing, minor units, webhooks, and the peer to peer profile.",
};

export default function ProposalsPage() {
  const proposals = listProposals();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">
        Proposals
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Draft RFCs for the next version
      </h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted">
        Nothing here is normative;{" "}
        <Link href="/spec" className="text-accent underline underline-offset-4">
          the 0.1 specification
        </Link>{" "}
        remains the only spec. Each draft names a concrete gap, proposes
        exact wire changes, and is argued in a GitHub issue. Where
        practical, the draft is prototyped in the repository&rsquo;s mock
        buyer host behind the{" "}
        <code className="font-mono text-sm">ANP_DRAFT=1</code> flag, with
        integration tests, so discussion happens against running code.
      </p>

      <ol className="mt-10 space-y-3">
        {proposals.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/proposals/${p.slug}`}
              className="group flex items-baseline gap-4 rounded-xl border border-line bg-raised p-5 transition-colors hover:border-accent"
            >
              <span className="font-mono text-sm text-accent">
                RFC-{p.number}
              </span>
              <span className="font-medium group-hover:text-accent-strong">
                {p.title}
              </span>
              {p.prototyped ? (
                <span className="ml-auto shrink-0 rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-medium text-ok">
                  prototyped
                </span>
              ) : (
                <span className="ml-auto shrink-0 rounded-full bg-inset px-2.5 py-0.5 text-xs text-faint">
                  draft only
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>

      <p className="mt-10 text-sm leading-relaxed text-muted">
        Discussion happens on{" "}
        <a
          href={`${GITHUB_REPO_URL}/issues`}
          rel="noopener"
          className="text-accent underline underline-offset-4"
        >
          the repository&rsquo;s issue tracker
        </a>
        ; the markdown sources live in{" "}
        <code className="font-mono text-xs">proposals/</code>. Anything
        that alters bytes on the wire lands in ANP/0.2, never in 0.1.
      </p>
    </div>
  );
}
