# aiaagentnetwork.com, the ANP protocol site

The public home of ANP, the Agent Negotiation Protocol: an open, MIT licensed
protocol that lets a vendor's AI selling agent and a buyer's AI negotiation
agent conduct a commercial negotiation over HTTPS with signed identity,
mandate exchange, structured offers, and a mutually verifiable hash chained
session log.

This repository contains:

- **`protocol/`** the authoritative spec (`SPEC.md`), the three JSON schemas,
  the example session log, and the MIT license. This directory is the single
  source of truth; the site renders these files at build time and never keeps
  copies of their text.
- **`src/lib/anp/`** the reference TypeScript client, written to be published
  as `@anp/client`: canonical JSON, Ed25519 signing, signed requests, and
  full chain verification. Node 18+ and browser compatible; the only
  platform interfaces used are `fetch` and `globalThis.crypto`.
- **`src/app/`** the Next.js site: landing page, rendered spec, schemas with
  stable raw URLs, the interactive playground, a standalone log verifier
  (`/verify`), the runnable buyer host conformance harness (`/conformance`),
  implementations, governance, and SDK documentation.
- **`packages/anp-client/`** the publishable `@anp/client` npm package. Its
  source is synced from `src/lib/anp/` at build time, so there is exactly
  one copy of the protocol code. `npm install && npm run build` inside the
  package emits `dist/` with types; `npm publish` from there once the npm
  org exists.
- **`packages/anp-client-py/`** the Python client, the protocol's second
  independent implementation. Its tests reproduce every published test
  vector byte for byte, verify the example log, and negotiate end to end
  against the Node mock host. `pip install -e "packages/anp-client-py[test]"`
  then `pytest packages/anp-client-py/tests`.
- **`packages/anp-mcp/`** `@anp/mcp-server`, an MCP server exposing the
  client as `anp_*` tools for MCP-capable agents. Build with
  `npm install && npm run build` inside the package; run with `anp-mcp`
  (or `node dist/index.js`) and set `ANP_BUYER_HOST` for a default host.
- **`scripts/mock-buyer-host.mjs`** a minimal in-memory buyer host for local
  playground and conformance harness development (see CORS below).

There are no secrets anywhere in this project. Both environment variables
are public configuration, no database or auth exists, and the playground's
private keys are generated in the visitor's browser and never leave it.
`.gitignore` still excludes every `.env*` file except `.env.example`, so a
secret can never land in history by accident.

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest suite for src/lib/anp
npm run typecheck  # tsc --noEmit
npm run build      # production build; every page is static
```

To exercise the playground locally without a live buyer host:

```bash
npm run mock-host  # deterministic sandbox buyer on http://localhost:8787
```

then paste `http://localhost:8787` into the playground's buyer host field.
The mock host implements the four endpoints of SPEC.md section 6 with real
Ed25519 verification, a real hash chain, and permissive CORS.

## Environment variables

Copy `.env.example` to `.env.local` and adjust. Neither variable is a secret.

| Variable | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical origin, used for metadata and OpenGraph URLs | `https://aiaagentnetwork.com` |
| `NEXT_PUBLIC_DEFAULT_BUYER_HOST` | Default buyer host base URL prefilled in the playground | `https://app.vendorbenchmark.com` |

## How the playground's CORS requirement works

The playground is entirely client side: the visitor's browser generates an
Ed25519 keypair, signs every request, and calls the buyer host's
`/api/agent/v1/*` endpoints directly with `fetch`. Because those are
cross-origin requests carrying custom `x-anp-*` headers, the buyer host must
answer CORS preflights and allow this site's origin (or `*`). A host that
does not allow the origin will simply never receive the playground's
requests; the playground surfaces this as a connectivity message. If you
operate a buyer host and want it usable from the playground, allow the
site's origin and the four `x-anp-*` request headers on the section 6
endpoints.

The raw schema routes on this site (`/schemas/*.schema.json`, `/schemas.zip`)
serve `access-control-allow-origin: *` so implementations can `$ref` or
download them from anywhere.

## Deploying

### Vercel

Import the repository, framework preset Next.js, no special configuration.
Set the two environment variables in the project settings. Every page
renders as static content at build time; the schema routes are prerendered
route handlers.

### Cloudflare Pages

Use the OpenNext Cloudflare adapter:

```bash
npm install --save-dev @opennextjs/cloudflare
npx opennextjs-cloudflare build
npx wrangler pages deploy
```

Set `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_DEFAULT_BUYER_HOST` as build
environment variables in the Pages project. The site uses no Node-only
runtime APIs at request time, so it fits the Workers runtime without
adjustment.

## Tests

`npm test` covers the protocol-critical code paths in `src/lib/anp/`:

- canonical JSON byte-for-byte determinism across insertion orders,
  unicode, and edge values
- the exact registration proof, canonical request, and authorship strings
  of SPEC.md sections 2 to 4
- full chain verification of `protocol/examples/session-log.example.json`,
  which must verify green including every Ed25519 signature
- tamper scenarios, each failing exactly the check it should
- the HTTP client's signed headers and error handling, against a stubbed
  `fetch`

## License

The specification and schemas are MIT licensed; see `protocol/LICENSE`. The
site code in this repository is offered under the same terms.
