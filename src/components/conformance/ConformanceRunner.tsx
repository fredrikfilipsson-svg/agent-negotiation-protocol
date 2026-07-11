"use client";

import { useCallback, useState } from "react";
import {
  type HarnessReport,
  type TestResult,
  runConformance,
} from "./harness";

const STATUS_STYLES: Record<TestResult["status"], string> = {
  pass: "bg-ok-soft text-ok",
  fail: "bg-bad-soft text-bad",
  skip: "bg-inset text-faint",
};

/**
 * The self-serve buyer host conformance runner: point it at a host URL and
 * the observable requirements of sections 2, 3, 4 and 6 are exercised live
 * from this browser.
 */
export function ConformanceRunner({ defaultHost }: { defaultHost: string }) {
  const [host, setHost] = useState(defaultHost);
  const [results, setResults] = useState<TestResult[]>([]);
  const [report, setReport] = useState<HarnessReport | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    setResults([]);
    setReport(null);
    try {
      const finished = await runConformance(host, (result) =>
        setResults((prev) => [...prev, result]),
      );
      setReport(finished);
    } finally {
      setRunning(false);
    }
  }, [host]);

  const download = useCallback(() => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anp-conformance-${new URL(report.host).hostname}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report]);

  return (
    <div className="mt-6 rounded-xl border border-line bg-raised p-5">
      <label
        htmlFor="conformance-host"
        className="block text-[11px] font-medium text-muted"
      >
        buyer host base URL
      </label>
      <div className="mt-1 flex flex-wrap gap-3">
        <input
          id="conformance-host"
          className="min-w-64 flex-1 rounded-md border border-line bg-canvas px-2.5 py-1.5 font-mono text-xs focus:border-accent"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => void run()}
          disabled={running || host.trim() === ""}
          className="rounded-md bg-accent px-4 py-2 text-xs font-medium text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {running ? "Running…" : "Run the harness"}
        </button>
        {report ? (
          <button
            type="button"
            onClick={download}
            className="rounded-md border border-line-strong px-4 py-2 text-xs font-medium transition-colors hover:border-accent hover:text-accent"
          >
            Download report
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        The harness runs from your browser, so the host must allow this
        origin in its CORS policy. It registers throwaway sandbox agents and
        opens sandbox sessions; it never touches live org handles.
      </p>

      {results.length > 0 ? (
        <ol className="mt-5 space-y-2" aria-live="polite">
          {results.map((result) => (
            <li
              key={result.id}
              className="flex items-start gap-3 rounded-lg border border-line bg-inset p-3"
            >
              <span
                className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium ${STATUS_STYLES[result.status]}`}
              >
                {result.status}
              </span>
              <div className="min-w-0">
                <p className="text-sm leading-snug">
                  {result.title}{" "}
                  <span className="whitespace-nowrap font-mono text-xs text-faint">
                    {result.ref}
                  </span>
                </p>
                <p className="mt-1 break-words font-mono text-[11px] leading-relaxed text-muted">
                  {result.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {report ? (
        <p
          role="status"
          className={`mt-4 font-mono text-sm ${
            report.failed === 0 ? "text-ok" : "text-bad"
          }`}
        >
          {report.passed} passed, {report.failed} failed, {report.skipped}{" "}
          skipped.
          {report.failed === 0 && report.skipped === 0
            ? " Every observable requirement holds."
            : ""}
        </p>
      ) : null}
    </div>
  );
}
