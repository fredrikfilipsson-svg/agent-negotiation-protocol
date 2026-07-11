import { highlightCode } from "@/lib/markdown";
import { CopyButton } from "./CopyButton";

/**
 * Server component: a Shiki-highlighted code block with a copy button.
 * Highlighting happens at build time; only the copy button ships JS.
 */
export async function Code({
  code,
  lang,
}: {
  code: string;
  lang: string;
}) {
  const html = await highlightCode(code.trimEnd(), lang);
  return (
    <div className="code-block">
      <CopyButton text={code.trimEnd()} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
