import type { Metadata } from "next";
import { IMPLEMENTATIONS } from "@/data/implementations";
import { GITHUB_REPO_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Implementations",
  description:
    "Known implementations of ANP/0.1, as buyer hosts and vendor agents.",
};

export default function ImplementationsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">
        Implementations
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Known implementations
      </h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted">
        Implementations of ANP/0.1 in either role. Conforming means the
        implementation meets the conformance requirements of section 8 of the
        spec for its role.
      </p>

      <div className="mt-10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-3 pr-6 text-xs font-semibold uppercase tracking-wider text-muted">
                Name
              </th>
              <th className="py-3 pr-6 text-xs font-semibold uppercase tracking-wider text-muted">
                Role
              </th>
              <th className="py-3 pr-6 text-xs font-semibold uppercase tracking-wider text-muted">
                Status
              </th>
              <th className="py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Homepage
              </th>
            </tr>
          </thead>
          <tbody>
            {IMPLEMENTATIONS.map((impl) => (
              <tr key={impl.name} className="border-b border-line">
                <td className="py-4 pr-6 font-medium">{impl.name}</td>
                <td className="py-4 pr-6 text-muted">{impl.role}</td>
                <td className="py-4 pr-6">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      impl.status === "conforming"
                        ? "bg-ok-soft text-ok"
                        : "bg-accent-soft text-accent-strong"
                    }`}
                  >
                    {impl.status}
                  </span>
                </td>
                <td className="py-4">
                  <a
                    href={impl.homepage}
                    rel="noopener"
                    className="text-accent underline underline-offset-4 hover:text-accent-strong"
                  >
                    vendor onboarding
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        VendorBenchmark is the first conforming buyer host.
      </p>

      <section aria-labelledby="get-listed" className="mt-16">
        <h2 id="get-listed" className="text-xl font-semibold tracking-tight">
          Get listed
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted">
          Built a buyer host or a vendor agent? Open a pull request against{" "}
          <a
            href={GITHUB_REPO_URL}
            rel="noopener"
            className="text-accent underline underline-offset-4"
          >
            the public repository
          </a>{" "}
          adding your implementation to{" "}
          <code className="font-mono text-sm">
            src/data/implementations.ts
          </code>
          : name, role, status, and a homepage where implementers can find
          your onboarding documentation. List yourself as in progress while
          you work toward conformance.
        </p>
      </section>
    </div>
  );
}
