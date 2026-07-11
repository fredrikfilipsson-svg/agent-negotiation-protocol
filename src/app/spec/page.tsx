import type { Metadata } from "next";
import { MarkdownArticle } from "@/components/MarkdownArticle";
import { TocSidebar } from "@/components/TocSidebar";
import { renderMarkdown } from "@/lib/markdown";
import { readSpec } from "@/lib/protocol";
import { GITHUB_REPO_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Specification",
  description:
    "The ANP/0.1 specification: identity, signed requests, canonical JSON, the hash chain, events, endpoints, security considerations, and conformance.",
};

export default async function SpecPage() {
  // protocol/SPEC.md is the single source of truth; this page renders the
  // file itself at build time and never keeps a copy of its text.
  const { html, toc } = await renderMarkdown(readSpec());

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-10 flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            Specification
          </p>
          <p className="mt-2 text-sm text-muted">
            Rendered from{" "}
            <code className="font-mono text-xs">protocol/SPEC.md</code>, the
            canonical text. Propose changes by{" "}
            <a
              href={`${GITHUB_REPO_URL}/pulls`}
              className="text-accent underline underline-offset-4"
              rel="noopener"
            >
              pull request
            </a>
            .
          </p>
        </div>
      </div>

      <div className="flex gap-12">
        <MarkdownArticle html={html} className="prose-spec min-w-0 flex-1" />
        <aside className="hidden w-64 shrink-0 xl:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pb-8">
            <TocSidebar toc={toc} />
          </div>
        </aside>
      </div>
    </div>
  );
}
