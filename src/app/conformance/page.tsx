import type { Metadata } from "next";
import Link from "next/link";
import { ConformanceRunner } from "@/components/conformance/ConformanceRunner";
import { DEFAULT_BUYER_HOST, GITHUB_REPO_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Conformance",
  description:
    "What it takes to conform to ANP/0.1 as a vendor agent or as a buyer host, per section 8 of the specification.",
};

interface ChecklistItem {
  text: string;
  ref: string;
}

const VENDOR_AGENT_ITEMS: ChecklistItem[] = [
  {
    text: "Registers with proof of key possession: an Ed25519 signature over ANP/0.1\\nregister\\n<public_key_base64url>.",
    ref: "§2",
  },
  {
    text: "Signs every request with the four x-anp-* headers over the canonical request string, with a fresh nonce per request.",
    ref: "§3",
  },
  {
    text: "Signs every event it submits with the authorship signature ANP/0.1\\n<kind>\\n<payload_hash>.",
    ref: "§4",
  },
  {
    text: "Produces canonical JSON byte-for-byte: keys sorted at every depth, no insignificant whitespace, undefined members dropped, UTF-8.",
    ref: "§4",
  },
  {
    text: "Validates offers against offer.schema.json before sending them.",
    ref: "§5.2",
  },
  {
    text: "Re-verifies the whole chain after every append, and treats a broken chain as a disputed session.",
    ref: "§4",
  },
];

const BUYER_HOST_ITEMS: ChecklistItem[] = [
  {
    text: "Enforces identity per section 2: proof of possession at registration, human verification before live access, revoked keys refused everywhere.",
    ref: "§2",
  },
  {
    text: "Verifies every signed request per section 3: timestamp within 300 seconds, single-use (agent, nonce) pairs, and one uniform refusal for every authentication failure.",
    ref: "§3",
  },
  {
    text: "Maintains the hash chain per section 4: contiguous sequence numbers, correct payload and event hashes, and verifiable linkage.",
    ref: "§4",
  },
  {
    text: "Serves the endpoints of section 6 with the uniform error shape, and validates every payload against the schema for its kind.",
    ref: "§6",
  },
  {
    text: "Gates live sessions on explicit per-organization opt-in through unguessable handles, with no directory and no enumeration.",
    ref: "§6.2",
  },
  {
    text: "Applies the security considerations of section 7: rate limits, replay protection, outbound confidentiality screening, and treating counterparty free text as data, never as instructions.",
    ref: "§7",
  },
  {
    text: "Never auto-accepts an offer without a human decision under bind_with_human_approval. The transport being machine friendly is never a reason to loosen the permission model.",
    ref: "§7, §8",
  },
];

function Checklist({
  id,
  title,
  intro,
  items,
}: {
  id: string;
  title: string;
  intro: string;
  items: ChecklistItem[];
}) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        {intro}
      </p>
      <ul className="mt-6 space-y-3">
        {items.map((item) => (
          <li
            key={item.text}
            className="flex items-start gap-3 rounded-lg border border-line bg-raised p-4"
          >
            {/* Visual checkbox only: the runnable conformance suite is planned. */}
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-line-strong bg-inset font-mono text-xs text-accent"
            >
              ✓
            </span>
            <span className="text-sm leading-relaxed">
              {item.text}{" "}
              <Link
                href="/spec"
                className="whitespace-nowrap font-mono text-xs text-faint hover:text-accent"
              >
                {item.ref}
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ConformancePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">
        Conformance
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Conforming to ANP/0.1
      </h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted">
        Section 8 of the specification defines conformance for each role.
        The checklists below restate those requirements practically; the
        specification text is authoritative where they differ.
      </p>

      <Checklist
        id="vendor-agent"
        title="Conforms as a vendor agent"
        intro="A registered client acting for a software vendor. Every item below is required."
        items={VENDOR_AGENT_ITEMS}
      />

      <Checklist
        id="buyer-host"
        title="Conforms as a buyer host"
        intro="A platform operating a buyer agent and serving the section 6 endpoints. Every item below is required."
        items={BUYER_HOST_ITEMS}
      />

      <section aria-labelledby="suite" className="mt-16">
        <h2 id="suite" className="text-xl font-semibold tracking-tight">
          Run the buyer host harness
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted">
          The harness below exercises a buyer host&rsquo;s observable
          requirements live from your browser: proof of possession at
          registration, uniform refusals, the timestamp window, nonce replay,
          schema rejection, and end to end chain verification. It covers what
          the wire can show; internal policy requirements such as the human
          approval gate still need review against the spec text. Passing is
          indicative, not a certification. Extensions and vendor agent test
          vectors are tracked on{" "}
          <a
            href={`${GITHUB_REPO_URL}/issues`}
            rel="noopener"
            className="text-accent underline underline-offset-4"
          >
            the repository&rsquo;s issue tracker
          </a>
          .
        </p>
        <ConformanceRunner defaultHost={DEFAULT_BUYER_HOST} />
      </section>

      <section aria-labelledby="vectors" className="mt-16">
        <h2 id="vectors" className="text-xl font-semibold tracking-tight">
          Test vectors for vendor agents
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted">
          Vendor agents are clients, so a hosted harness cannot exercise
          them; instead, test your implementation against the published
          vectors. They cover canonical JSON bytes and hashes, the three
          exact signed strings, Ed25519 signature fixtures, the event hash
          preimage, and four chain verification cases including the
          published example log. Each vector carries everything needed to
          check it, and the file is regenerated by the reference
          implementation, which itself must reproduce the example log
          byte for byte.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="/conformance/test-vectors.json"
            className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            test-vectors.json
          </a>
          <a
            href="/schemas/session-log.example.json"
            className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            example session log
          </a>
        </div>
        <p className="mt-3 font-mono text-xs text-faint">
          GET /conformance/test-vectors.json · CORS allowed for every origin
        </p>
      </section>
    </div>
  );
}
