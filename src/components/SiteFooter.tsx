import Link from "next/link";
import { GITHUB_REPO_URL, PROTOCOL_VERSION } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-mono text-xs">
          {PROTOCOL_VERSION} · draft · MIT licensed
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <li>
              <a
                href={GITHUB_REPO_URL}
                className="hover:text-fg"
                rel="noopener"
              >
                GitHub
              </a>
            </li>
            <li>
              <Link href="/governance" className="hover:text-fg">
                License
              </Link>
            </li>
            <li>
              <Link href="/spec" className="hover:text-fg">
                Specification
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
