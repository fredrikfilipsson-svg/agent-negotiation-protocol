"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_ITEMS } from "@/lib/site";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-baseline gap-2 font-mono text-sm font-semibold tracking-tight"
          onClick={() => setOpen(false)}
        >
          <span aria-hidden="true" className="text-accent">
            ⛓
          </span>
          <span>
            ANP<span className="text-muted">/0.1</span>
          </span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-accent-soft text-accent-strong"
                        : "text-muted hover:text-fg"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          className="ml-auto rounded-md border border-line px-3 py-1.5 text-sm text-muted md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          Menu
        </button>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-line md:hidden"
        >
          <ul className="mx-auto max-w-6xl px-4 py-2 sm:px-6">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`block rounded-md px-3 py-2 text-sm ${
                      active
                        ? "bg-accent-soft text-accent-strong"
                        : "text-muted hover:text-fg"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
