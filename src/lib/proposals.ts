import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Build-time readers for the RFC drafts in proposals/. Like protocol/,
 * the markdown files are the source of truth; the site renders them and
 * never keeps copies.
 */

const PROPOSALS_DIR = join(process.cwd(), "proposals");

export interface ProposalMeta {
  slug: string;
  number: string;
  title: string;
  prototyped: boolean;
}

export function listProposals(): ProposalMeta[] {
  return readdirSync(PROPOSALS_DIR)
    .filter((name) => /^\d{3}-.*\.md$/.test(name))
    .sort()
    .map((name) => {
      const slug = name.replace(/\.md$/, "");
      const text = readFileSync(join(PROPOSALS_DIR, name), "utf8");
      const heading = text.match(/^# RFC-(\d+): (.+)$/m);
      return {
        slug,
        number: heading?.[1] ?? slug.slice(0, 3),
        title: heading?.[2] ?? slug,
        prototyped: text.includes("ANP_DRAFT=1"),
      };
    });
}

export function readProposal(slug: string): string {
  if (!/^\d{3}-[a-z0-9-]+$/.test(slug)) {
    throw new Error(`invalid proposal slug: ${slug}`);
  }
  return readFileSync(join(PROPOSALS_DIR, `${slug}.md`), "utf8");
}
