"use client";

import Link from "next/link";

import { EvidenceCitationList } from "./EvidenceCitationList";

type Status = "PASS" | "WARNING" | "FAIL";

type CompatibilityResult = {
  id: string;
  level: Status;
  title: string;
  explanation: string;
  affectedParts: string[];
  confidence: number;
  ruleId: string;
  evidence: Array<{
    evidenceId?: string;
    sourceId?: string;
    citationNumber: number;
    title: string;
    sourceType: string;
    publisher: string;
    url?: string | null;
    confidenceScore: number;
    capturedAt: string;
    claim: string;
    value: string;
    unit?: string | null;
    notes?: string | null;
  }>;
};

export function SourceBackedCompatibilityReport({ results }: { results: CompatibilityResult[] }) {
  return (
    <div className="grid gap-3">
      {results.map((result) => (
        <details key={result.id} className="rounded-md border border-zinc-200 bg-white p-4">
          <summary className="cursor-pointer list-none">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={result.level} />
                  <div className="font-medium text-zinc-950">{result.title}</div>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{result.explanation}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.evidence.map((citation) => (
                    citation.evidenceId ? (
                    <Link
                      key={`${result.id}-${citation.citationNumber}-${citation.claim}`}
                      href={`/evidence/${citation.evidenceId}`}
                      className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700"
                    >
                      [{citation.citationNumber}] {citation.sourceType === "seeded_demo" ? "Seeded demo source" : citation.title}
                    </Link>
                    ) : (
                      <span
                        key={`${result.id}-${citation.citationNumber}-${citation.claim}`}
                        className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700"
                      >
                        [{citation.citationNumber}] {citation.sourceType === "seeded_demo" ? "Seeded demo source" : citation.title}
                      </span>
                    )
                  ))}
                </div>
              </div>
              <div className="text-right text-xs text-zinc-500">
                <div>{Math.round(result.confidence * 100)}%</div>
                <div>{result.ruleId}</div>
              </div>
            </div>
          </summary>
          <div className="mt-4 border-t border-zinc-100 pt-4">
            <EvidenceCitationList citations={result.evidence} />
          </div>
        </details>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const className =
    status === "PASS"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "WARNING"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-rose-50 text-rose-700 ring-rose-200";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>{status}</span>;
}
