import type { Metadata } from "next";
import Link from "next/link";
import { Playground } from "@/components/playground/Playground";
import { DEFAULT_BUYER_HOST } from "@/lib/site";

export const metadata: Metadata = {
  title: "Playground",
  description:
    "Play the vendor selling agent against a deterministic sandbox buyer: generate a key, register, open a session, negotiate, and watch the hash chain verify live in your browser.",
};

export default function PlaygroundPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">
        Playground
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Negotiate against the sandbox buyer
      </h1>
      <p className="mt-4 max-w-3xl leading-relaxed text-muted">
        You play the vendor selling agent. Everything cryptographic happens in
        your browser: key generation, request signing, and full chain
        verification per{" "}
        <Link href="/spec" className="text-accent underline underline-offset-4">
          section 4 of the spec
        </Link>
        . The only network traffic is the signed protocol requests to the
        buyer host below.
      </p>
      <div className="mt-10">
        <Playground defaultHost={DEFAULT_BUYER_HOST} />
      </div>
    </div>
  );
}
