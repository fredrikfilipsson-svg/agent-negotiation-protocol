import type { Metadata } from "next";
import { Code } from "@/components/Code";
import { readSchema, SCHEMA_FILES } from "@/lib/protocol";

export const metadata: Metadata = {
  title: "Schemas",
  description:
    "The three ANP/0.1 JSON Schemas: mandate envelope, offer, and session log event. Served raw at stable URLs with permissive CORS.",
};

const DESCRIPTIONS: Record<(typeof SCHEMA_FILES)[number], string> = {
  "envelope.schema.json":
    "The mandate envelope both sides declare at session open: party, agent (which must declare itself an AI), what it may discuss and disclose, and its offer authority.",
  "offer.schema.json":
    "Offers and counter-offers: currency, term, required expiry, 1 to 200 line items with quantities and unit prices, conditions, and notes. Unknown keys are rejected.",
  "event.schema.json":
    "One event in the session log: seq, actor, kind, payload, the three hashes that form the chain, the authorship signature, and its signer.",
};

export default function SchemasPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">
        Schemas
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        JSON Schemas
      </h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted">
        Three schemas define every structured payload in ANP/0.1. They are
        served raw at stable URLs on this domain with permissive CORS, so
        your implementation can <code className="font-mono text-sm">$ref</code>{" "}
        them or vendor them. Validation is strict:{" "}
        <code className="font-mono text-sm">additionalProperties</code> is
        false everywhere, and unknown keys are rejected, not ignored.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href="/schemas.zip"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-canvas transition-opacity hover:opacity-90"
          download
        >
          Download all three (zip)
        </a>
        <a
          href="/schemas/session-log.example.json"
          className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
        >
          Example session log
        </a>
      </div>

      <div className="mt-12 space-y-14">
        {SCHEMA_FILES.map((name) => (
          <section key={name} aria-labelledby={name}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={name} className="font-mono text-lg font-semibold">
                {name}
              </h2>
              <a
                href={`/schemas/${name}`}
                download={name}
                className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent hover:text-accent"
              >
                Download
              </a>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {DESCRIPTIONS[name]}
            </p>
            <p className="mt-2 font-mono text-xs text-faint">
              GET /schemas/{name}
            </p>
            <div className="mt-4 text-sm">
              <Code code={readSchema(name)} lang="json" />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
