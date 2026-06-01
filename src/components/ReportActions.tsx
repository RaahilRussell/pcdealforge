"use client";

import { useState } from "react";
import Link from "next/link";
import { Clipboard, Download, FileText, RefreshCcw } from "lucide-react";

export function ReportActions({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);

  async function copyPartsList() {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function exportMarkdown() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pcdealforge-build-report.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="#parts"
        className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:border-zinc-500"
      >
        <FileText className="h-4 w-4" />
        View all part links
      </Link>
      <button
        type="button"
        onClick={copyPartsList}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:border-zinc-500"
      >
        <Clipboard className="h-4 w-4" />
        {copied ? "Copied" : "Copy parts list"}
      </button>
      <button
        type="button"
        onClick={exportMarkdown}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:border-zinc-500"
      >
        <Download className="h-4 w-4" />
        Export markdown
      </button>
      <Link
        href="/#builder"
        className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800"
      >
        <RefreshCcw className="h-4 w-4" />
        Re-run constraints
      </Link>
    </div>
  );
}
