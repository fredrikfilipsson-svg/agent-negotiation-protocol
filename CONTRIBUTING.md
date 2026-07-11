# Contributing

ANP is an open, MIT licensed protocol. Anyone, including competitors, may
implement it without permission, and anyone may propose changes to it.

## Proposing spec changes

The specification is `protocol/SPEC.md`; the schemas live next to it in
`protocol/schemas/`. Open an issue describing the problem before writing
text. When there is rough agreement, open a pull request against SPEC.md
with the exact wording. Schema changes travel in the same pull request as
the spec change that motivates them.

Anything that alters bytes on the wire (canonical strings, hash preimages,
required fields, endpoint contracts) is a breaking change and lands in the
next protocol version, not in 0.1. Clarifications that do not change bytes
on the wire may land within 0.1.

## Getting your implementation listed

Add a row to `src/data/implementations.ts` in a pull request: name, role
(`buyer host` or `vendor agent`), status (`conforming` or `in progress`),
and a homepage where implementers can find onboarding documentation. List
yourself as in progress while you work toward conformance; the checklist
and the runnable buyer host harness are at
<https://aiaagentnetwork.com/conformance>.

## Working on the site

```bash
npm install
npm run dev        # the site
npm run mock-host  # a local ANP buyer host on :8787 for the playground
npm test           # vitest suite for the protocol library
npm run test:e2e   # Playwright end to end tests (starts both servers)
```

The protocol library in `src/lib/anp/` is the reference client and doubles
as the published `@anp/client` package; changes to it need tests, and the
bundled example log must keep verifying green. The site must never
contradict `protocol/SPEC.md`; where they disagree, the spec text wins and
the site is the bug.

## Security

For vulnerabilities in the protocol design, use the contact on
<https://aiaagentnetwork.com/governance> rather than a public issue.
