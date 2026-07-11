import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownArticle } from "@/components/MarkdownArticle";
import { renderMarkdown } from "@/lib/markdown";
import { listProposals, readProposal } from "@/lib/proposals";
import { GITHUB_REPO_URL } from "@/lib/site";

export function generateStaticParams() {
  return listProposals().map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = listProposals().find((p) => p.slug === slug);
  return {
    title: meta ? `RFC-${meta.number}: ${meta.title}` : "Proposal",
    description: `Draft proposal for ANP/0.2: ${meta?.title ?? slug}. Not normative; discussed on GitHub.`,
  };
}

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = listProposals().find((p) => p.slug === slug);
  if (!meta) notFound();

  const { html } = await renderMarkdown(readProposal(slug));

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">
        <Link href="/proposals" className="hover:underline">
          Proposals
        </Link>{" "}
        · draft, not normative
      </p>
      <MarkdownArticle html={html} className="prose-spec mt-6" />
      <p className="mt-12 border-t border-line pt-6 text-sm leading-relaxed text-muted">
        Source:{" "}
        <a
          href={`${GITHUB_REPO_URL}/blob/main/proposals/${slug}.md`}
          rel="noopener"
          className="text-accent underline underline-offset-4"
        >
          proposals/{slug}.md
        </a>
        . Comment on the corresponding issue in{" "}
        <a
          href={`${GITHUB_REPO_URL}/issues`}
          rel="noopener"
          className="text-accent underline underline-offset-4"
        >
          the tracker
        </a>
        .
      </p>
    </div>
  );
}
