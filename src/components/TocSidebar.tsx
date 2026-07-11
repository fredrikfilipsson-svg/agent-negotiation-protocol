"use client";

import { useEffect, useState } from "react";
import type { TocEntry } from "@/lib/markdown";

/**
 * Sticky table of contents with scroll spy. Highlights the heading nearest
 * the top of the viewport as the reader scrolls.
 */
export function TocSidebar({ toc }: { toc: TocEntry[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const headings = toc
      .map((entry) => document.getElementById(entry.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // Highlight the first visible heading; when none are visible
        // (mid-section), keep the last heading scrolled past the top.
        const firstVisible = headings.find((h) => visible.has(h.id));
        if (firstVisible) {
          setActiveId(firstVisible.id);
        } else {
          const scrolledPast = headings.filter(
            (h) => h.getBoundingClientRect().top < 120,
          );
          if (scrolledPast.length > 0) {
            setActiveId(scrolledPast[scrolledPast.length - 1].id);
          }
        }
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );
    for (const heading of headings) observer.observe(heading);
    return () => observer.disconnect();
  }, [toc]);

  return (
    <nav aria-label="Table of contents" className="text-sm">
      <p className="mb-3 font-mono text-xs uppercase tracking-wider text-faint">
        On this page
      </p>
      <ul className="space-y-1 border-l border-line">
        {toc.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              aria-current={activeId === entry.id ? "location" : undefined}
              className={`block border-l-2 py-0.5 pr-2 leading-snug transition-colors ${
                entry.depth === 3 ? "pl-7" : "pl-4"
              } ${
                activeId === entry.id
                  ? "-ml-px border-accent text-accent-strong"
                  : "-ml-px border-transparent text-muted hover:text-fg"
              }`}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
