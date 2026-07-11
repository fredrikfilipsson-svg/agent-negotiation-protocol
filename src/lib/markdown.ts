import rehypeShiki from "@shikijs/rehype";
import GithubSlugger from "github-slugger";
import { toString as mdastToString } from "mdast-util-to-string";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type { Root as MdastRoot, Heading } from "mdast";

export interface TocEntry {
  id: string;
  text: string;
  depth: number;
}

export interface RenderedMarkdown {
  html: string;
  toc: TocEntry[];
}

/** Shiki dual-theme options; CSS switches on prefers-color-scheme. */
const SHIKI_OPTIONS = {
  themes: { light: "github-light", dark: "github-dark" },
  defaultColor: false,
} as const;

/**
 * Extract the table of contents with the same slugger rehype-slug uses,
 * so TOC ids always match the rendered heading ids.
 */
function extractToc(tree: MdastRoot): TocEntry[] {
  const slugger = new GithubSlugger();
  const toc: TocEntry[] = [];
  visit(tree, "heading", (node: Heading) => {
    const text = mdastToString(node);
    const id = slugger.slug(text);
    if (node.depth >= 2 && node.depth <= 3) {
      toc.push({ id, text, depth: node.depth });
    }
  });
  return toc;
}

/**
 * Render markdown to HTML at build time: GFM tables, slugged headings with
 * anchor links, Shiki-highlighted code blocks wrapped for the copy button
 * event delegation in MarkdownArticle.
 */
export async function renderMarkdown(
  markdown: string,
): Promise<RenderedMarkdown> {
  const parsed = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const toc = extractToc(parsed);

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeShiki, SHIKI_OPTIONS)
    .use(rehypeStringify)
    .run(parsed);

  let html = unified().use(rehypeStringify).stringify(file as never);

  // Wrap each code block so a copy button can be positioned over it. The
  // button is injected here (static HTML); MarkdownArticle attaches one
  // delegated click handler.
  html = html.replace(
    /<pre class="shiki/g,
    '<div class="code-block"><button type="button" class="copy-button" data-copy aria-label="Copy code">copy</button><pre class="shiki',
  );
  html = html.replace(/<\/pre>/g, "</pre></div>");

  // Add a visible anchor link inside each h2/h3.
  html = html.replace(
    /<(h[23]) id="([^"]+)">/g,
    '<$1 id="$2"><a class="heading-anchor" href="#$2" aria-label="Link to this section">#</a>',
  );

  return { html, toc };
}

/** Highlight a standalone code snippet with the same dual-theme setup. */
export async function highlightCode(
  code: string,
  lang: string,
): Promise<string> {
  const { codeToHtml } = await import("shiki");
  return codeToHtml(code, { lang, ...SHIKI_OPTIONS });
}
