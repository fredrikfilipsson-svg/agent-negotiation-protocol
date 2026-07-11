"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label = "copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copy-button"
      data-copied={copied || undefined}
      aria-label="Copy code"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
    >
      {copied ? "copied" : label}
    </button>
  );
}
