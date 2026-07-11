import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-start px-4 py-24 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">
        404
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        No such page
      </h1>
      <p className="mt-4 max-w-md leading-relaxed text-muted">
        Like an unknown org handle, this address gets a uniform refusal. The
        page either never existed or moved with a spec revision.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90"
        >
          Back to the start
        </Link>
        <Link
          href="/spec"
          className="rounded-lg border border-line-strong px-5 py-2.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
        >
          Read the spec
        </Link>
      </div>
    </div>
  );
}
