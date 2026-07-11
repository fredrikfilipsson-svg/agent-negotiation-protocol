import type { Metadata } from "next";
import Link from "next/link";
import { Code } from "@/components/Code";
import { GITHUB_REPO_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "SDK",
  description:
    "The reference TypeScript client for ANP/0.1: generate an identity, register, open a session, send offers, and verify the chain.",
};

const INSTALL = `# The reference client is MIT licensed TypeScript with zero runtime
# dependencies. The publishable package lives in packages/anp-client of
# the repository; until it lands on npm, build it from source or vendor
# src/lib/anp/ directly.
git clone ${GITHUB_REPO_URL}
cd agent-negotiation-protocol/packages/anp-client
npm install && npm run build   # emits dist/ with types
npm pack                       # or: npm link`;

const GENERATE = `import { generateIdentity } from "@anp/client";

// A fresh Ed25519 keypair via WebCrypto. Works in Node 18+ and in
// browsers; the private key is non extractable and never leaves the
// process.
const identity = await generateIdentity();

console.log(identity.publicKey); // raw 32-byte key, base64url
console.log(identity.fingerprint); // sha256 hex, shown to humans`;

const REGISTER = `import { register } from "@anp/client";

// Registration proves key possession by signing
// "ANP/0.1\\nregister\\n<public_key_base64url>". Unverified agents get
// sandbox access; a human at the host verifies you before live sessions.
const host = "https://app.example.com";

const registration = await register(host, identity, {
  agent_name: "Acme Selling Agent",
  vendor_name: "Acme Software",
  contact_email: "agents@acme.example",
});

console.log(registration.agentId); // host assigned UUID
console.log(registration.status); // "sandbox" until verified`;

const OPEN_SESSION = `import { openSession } from "@anp/client";

// Both sides open with a mandate envelope. declared_ai must be true:
// ANP has no undeclared bots.
const opened = await openSession(
  host,
  identity,
  {
    party: "Acme Software",
    agent: { name: "Acme Selling Agent", declared_ai: true },
    may_discuss: ["renewal pricing", "term length"],
    may_disclose: ["list pricing", "standard discount bands"],
    will_not_disclose: ["floor pricing"],
    offer_authority: "propose_only",
    human_contact: "sales@acme.example",
  },
  { sandbox: true }, // or { org_handle: "anp_org_..." } for a live buyer
);

console.log(opened.sessionId);
console.log(opened.buyerEnvelope); // what the buyer's agent may do`;

const SEND_OFFER = `import { sendEvent } from "@anp/client";

// The payload is hashed over its canonical JSON and signed with the
// authorship signature "ANP/0.1\\n<kind>\\n<payload_hash>" before it is
// sent. The returned log may already contain the buyer's response.
const log = await sendEvent(host, identity, opened.sessionId, "offer", {
  currency: "USD",
  term_months: 12,
  expires_at: "2026-08-01T00:00:00Z",
  line_items: [
    {
      sku: "CRM-ENT",
      description: "CRM Enterprise seats",
      quantity: 500,
      unit: "seat/year",
      unit_price: 1200,
      currency: "USD",
    },
  ],
  conditions: ["Net 30 payment"],
});`;

const VERIFY = `import { fetchLog, verifyLog } from "@anp/client";

// Re-verify after every append, per the spec: contiguous sequence
// numbers, payload hashes, chain linkage, event hashes, and every
// Ed25519 authorship signature.
const latest = await fetchLog(host, identity, opened.sessionId);
const verdict = await verifyLog(latest);

if (!verdict.ok) {
  // A broken chain is a disputed session. The verdict names each
  // failing check per event.
  for (const event of verdict.events.filter((e) => !e.ok)) {
    console.error(event.seq, event.checks.filter((c) => !c.ok));
  }
  throw new Error("chain verification failed");
}

console.log(\`verified \${verdict.verifiedCount}/\${verdict.eventCount} events\`);`;

const STEPS: Array<{ id: string; title: string; body: string; code: string; lang: string }> = [
  {
    id: "install",
    title: "Install",
    body: "The client is a single dependency free module. It uses fetch and globalThis.crypto only, so the same code runs in Node 18+ and in browsers.",
    code: INSTALL,
    lang: "bash",
  },
  {
    id: "identity",
    title: "Generate an identity",
    body: "An agent identity is a raw 32-byte Ed25519 public key. Its fingerprint, the SHA-256 of the raw key bytes, is the identity humans see.",
    code: GENERATE,
    lang: "ts",
  },
  {
    id: "register",
    title: "Register with a buyer host",
    body: "Registration is unauthenticated but proves you hold the private key. The returned agent id goes into the x-anp-agent header of every later request; the client stores it on the identity for you.",
    code: REGISTER,
    lang: "ts",
  },
  {
    id: "session",
    title: "Open a session",
    body: "Sessions open against the sandbox, or against a buyer-issued org handle for live negotiations. The host appends your session_open and the buyer's envelope as events 1 and 2.",
    code: OPEN_SESSION,
    lang: "ts",
  },
  {
    id: "offer",
    title: "Send an offer",
    body: "Offers are strict JSON per offer.schema.json. Validate before sending; hosts reject unknown keys rather than ignoring them.",
    code: SEND_OFFER,
    lang: "ts",
  },
  {
    id: "verify",
    title: "Verify the chain",
    body: "Verification is a pure function over the log document. Run it after every append; if it fails, stop negotiating and involve a human.",
    code: VERIFY,
    lang: "ts",
  },
];

export default function SdkPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">
        SDK
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        The reference TypeScript client
      </h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted">
        A minimal client for the vendor agent side of ANP/0.1. It lives in
        this site&rsquo;s repository under{" "}
        <code className="font-mono text-sm">src/lib/anp/</code>, doubles as
        the crypto behind the{" "}
        <Link
          href="/playground"
          className="text-accent underline underline-offset-4"
        >
          playground
        </Link>
        , and is written to be published as{" "}
        <code className="font-mono text-sm">@anp/client</code>. Exports:{" "}
        <code className="font-mono text-sm">generateIdentity</code>,{" "}
        <code className="font-mono text-sm">register</code>,{" "}
        <code className="font-mono text-sm">openSession</code>,{" "}
        <code className="font-mono text-sm">sendEvent</code>,{" "}
        <code className="font-mono text-sm">fetchLog</code>,{" "}
        <code className="font-mono text-sm">verifyLog</code>, plus the
        canonical JSON and signing primitives.
      </p>

      <div className="mt-12 space-y-14">
        {STEPS.map((step, i) => (
          <section key={step.id} aria-labelledby={step.id}>
            <h2 id={step.id} className="text-xl font-semibold tracking-tight">
              <span className="mr-3 font-mono text-sm text-accent">
                {i + 1}
              </span>
              {step.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {step.body}
            </p>
            <div className="mt-4 text-sm">
              <Code code={step.code} lang={step.lang} />
            </div>
          </section>
        ))}
      </div>

      <section aria-labelledby="mcp" className="mt-14 border-t border-line pt-10">
        <h2 id="mcp" className="text-xl font-semibold tracking-tight">
          For MCP-capable agents
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          The repository also ships an MCP server,{" "}
          <code className="font-mono text-sm">packages/anp-mcp</code>, that
          exposes the same client as tools:{" "}
          <code className="font-mono text-xs">anp_generate_identity</code>,{" "}
          <code className="font-mono text-xs">anp_register</code>,{" "}
          <code className="font-mono text-xs">anp_open_session</code>,{" "}
          <code className="font-mono text-xs">anp_send_offer</code>,{" "}
          <code className="font-mono text-xs">anp_send_message</code>,{" "}
          <code className="font-mono text-xs">anp_fetch_log</code>, and{" "}
          <code className="font-mono text-xs">anp_verify_log</code>. Every
          log is re-verified locally before it reaches the model, and the
          private key stays in the server process. The server is a
          transport: offer decisions stay with your agent&rsquo;s mandate
          and its human approval process.
        </p>
      </section>

      <p className="mt-14 border-t border-line pt-8 text-sm leading-relaxed text-muted">
        The full verification rules live in section 4 of{" "}
        <Link href="/spec" className="text-accent underline underline-offset-4">
          the specification
        </Link>
        . The client&rsquo;s test suite includes byte-for-byte canonical JSON
        checks and verifies the published example session log green. To
        check a log without writing code, use{" "}
        <Link href="/verify" className="text-accent underline underline-offset-4">
          the verifier
        </Link>
        .
      </p>
    </div>
  );
}
