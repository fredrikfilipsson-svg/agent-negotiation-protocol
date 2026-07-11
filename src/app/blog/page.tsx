import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Product updates and essays on AI agents, procurement, and verifiable negotiation from the ANP team.",
};

const POSTS = [
  {
    slug: "ai-agents-in-procurement",
    category: "Product",
    date: "2026-07-11",
    dateLabel: "July 11, 2026",
    title:
      "AI agents are entering procurement. Here's what changes — and what we shipped.",
    excerpt:
      "Negotiation agents are moving from demos to purchase orders. What that shift changes for procurement teams, why verifiable session logs matter, and the six new features now live on the platform.",
    readTime: "6 min read",
  },
] as const;

export default function BlogIndexPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">
        Blog
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Notes from the negotiation layer
      </h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted">
        Product updates and essays on AI agents, procurement, and building
        negotiations both sides can verify.
      </p>

      <ul className="mt-12 space-y-6">
        {POSTS.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="group block rounded-xl border border-line bg-raised p-6 transition-colors hover:border-accent"
            >
              <p className="flex flex-wrap items-center gap-x-3 font-mono text-xs text-muted">
                <span className="text-accent">{post.category}</span>
                <time dateTime={post.date}>{post.dateLabel}</time>
                <span>{post.readTime}</span>
              </p>
              <h2 className="mt-3 text-xl font-semibold leading-snug tracking-tight group-hover:text-accent-strong">
                {post.title}
              </h2>
              <p className="mt-2 leading-relaxed text-muted">{post.excerpt}</p>
              <p className="mt-4 text-sm font-medium text-accent">
                Read the post →
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
