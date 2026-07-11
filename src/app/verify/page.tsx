import type { Metadata } from "next";
import Link from "next/link";
import { VerifyTool } from "@/components/verify/VerifyTool";

export const metadata: Metadata = {
  title: "Verify a log",
  description:
    "Paste any ANP/0.1 session log and verify the whole chain in your browser: hashes, linkage, and every Ed25519 authorship signature.",
};

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">
        Verify
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Verify a session log
      </h1>
      <p className="mt-4 max-w-3xl leading-relaxed text-muted">
        The point of the hash chain is that anyone can check it without
        trusting the host that stored it. This page is that check: paste a
        session log document and every rule from{" "}
        <Link href="/spec" className="text-accent underline underline-offset-4">
          section 4 of the spec
        </Link>{" "}
        runs locally in your browser. Auditors and counterparties can use it
        on exported logs; implementers can use it while debugging a host.
      </p>
      <VerifyTool />
    </div>
  );
}
