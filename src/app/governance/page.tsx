import type { Metadata } from "next";
import { readLicense } from "@/lib/protocol";
import { GITHUB_REPO_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Governance",
  description:
    "How ANP is licensed, how to propose changes to the specification, the versioning policy, and where to report security issues.",
};

export default function GovernancePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">
        Governance
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        License, changes, and versioning
      </h1>

      <section aria-labelledby="changes" className="mt-12">
        <h2 id="changes" className="text-xl font-semibold tracking-tight">
          Proposing changes
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted">
          The specification lives as{" "}
          <code className="font-mono text-sm">protocol/SPEC.md</code> in{" "}
          <a
            href={GITHUB_REPO_URL}
            rel="noopener"
            className="text-accent underline underline-offset-4"
          >
            the public repository
          </a>
          . Open an issue to discuss a change, or a pull request against
          SPEC.md to propose exact text. Schema changes travel with the spec
          change that motivates them, in the same pull request. Discussion is
          public; decisions and their reasoning stay in the issue history.
        </p>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted">
          Draft RFCs for the next protocol version, several with running
          prototypes, are collected under{" "}
          <a
            href="/proposals"
            className="text-accent underline underline-offset-4"
          >
            proposals
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="versioning" className="mt-12">
        <h2 id="versioning" className="text-xl font-semibold tracking-tight">
          Versioning policy
        </h2>
        <div className="mt-3 max-w-2xl space-y-4 leading-relaxed text-muted">
          <p>
            The version string{" "}
            <code className="font-mono text-sm">ANP/0.1</code> is baked into
            every signature and every hash: the registration proof, the
            canonical request string, the event hash preimage, and the
            authorship signature all begin with it. Mixed-version sessions
            therefore fail closed rather than subtly.
          </p>
          <p>
            Any change that alters bytes on the wire is breaking and bumps
            the version to <code className="font-mono text-sm">ANP/0.2</code>
            : new or changed canonical string formats, hash preimages,
            required envelope or offer fields, event kinds with new
            semantics, or endpoint contracts. Candidates already named in the
            spec include webhooks in place of polling and a symmetric peer to
            peer profile.
          </p>
          <p>
            Clarifications that do not change bytes on the wire, such as
            wording, examples, and this site, may land within 0.1.
          </p>
        </div>
      </section>

      <section aria-labelledby="security" className="mt-12">
        <h2 id="security" className="text-xl font-semibold tracking-tight">
          Reporting security issues
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted">
          For vulnerabilities in the protocol design, email{" "}
          <a
            href="mailto:info@redresscompliance.com"
            className="text-accent underline underline-offset-4"
          >
            info@redresscompliance.com
          </a>{" "}
          rather than opening a public issue. For vulnerabilities in a
          specific implementation, contact that implementation&rsquo;s
          maintainer directly.
        </p>
      </section>

      <section aria-labelledby="license" className="mt-12">
        <h2 id="license" className="text-xl font-semibold tracking-tight">
          License
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted">
          The specification and the schemas are MIT licensed. Anyone,
          including competitors, may implement ANP without permission. The
          full text, from <code className="font-mono text-sm">protocol/LICENSE</code>:
        </p>
        <pre className="mt-6 overflow-x-auto whitespace-pre-wrap rounded-lg border border-line bg-inset p-6 font-mono text-xs leading-relaxed text-muted">
          {readLicense()}
        </pre>
      </section>
    </div>
  );
}
