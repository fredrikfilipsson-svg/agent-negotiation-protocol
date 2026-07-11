"use client";

import { useCallback } from "react";

/**
 * Renders build-time markdown HTML and wires up the copy buttons that
 * renderMarkdown injected, via one delegated click handler.
 */
export function MarkdownArticle({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const onClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-copy]",
    );
    if (!target) return;
    const pre = target.parentElement?.querySelector("pre");
    if (!pre) return;
    navigator.clipboard.writeText(pre.innerText).then(() => {
      target.dataset.copied = "true";
      target.textContent = "copied";
      window.setTimeout(() => {
        delete target.dataset.copied;
        target.textContent = "copy";
      }, 1600);
    });
  }, []);

  return (
    <article
      className={className}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
