/** Site-wide constants. Both env vars are public and non secret. */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://aiaagentnetwork.com";

export const DEFAULT_BUYER_HOST =
  process.env.NEXT_PUBLIC_DEFAULT_BUYER_HOST ??
  "https://app.vendorbenchmark.com";

export const GITHUB_REPO_URL =
  "https://github.com/fredrikfilipsson-svg/agent-negotiation-protocol";

export const PROTOCOL_VERSION = "ANP/0.1";

export const SITE_NAME = "ANP, the Agent Negotiation Protocol";

export const SITE_TAGLINE =
  "An open protocol for AI agents to negotiate commercial terms with signed identity, declared mandates, structured offers, and a verifiable session log.";

export const NAV_ITEMS = [
  { href: "/spec", label: "Spec" },
  { href: "/schemas", label: "Schemas" },
  { href: "/playground", label: "Playground" },
  { href: "/verify", label: "Verify" },
  { href: "/implementations", label: "Implementations" },
  { href: "/conformance", label: "Conformance" },
  { href: "/governance", label: "Governance" },
  { href: "/sdk", label: "SDK" },
] as const;
