"use client";

import Link from "next/link";

type EvidenceCitation = {
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
};

export function EvidenceCitationList({ citations }: { citations: EvidenceCitation[] }) {
  if (citations.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        No evidence citations are attached to this section.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {citations.map((citation) => (
        <details key={`${citation.citationNumber}-${citation.claim}`} className="rounded-md border border-zinc-200 bg-white p-3">
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-zinc-950">
                  [{citation.citationNumber}] {citation.title}
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  {citation.sourceType === "seeded_demo" ? "Seeded demo source" : citation.sourceType.replaceAll("_", " ")} ·{" "}
                  {citation.publisher}
                </div>
              </div>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                {Math.round(citation.confidenceScore * 100)}%
              </span>
            </div>
          </summary>
          <div className="mt-3 border-t border-zinc-100 pt-3 text-sm leading-6 text-zinc-700">
            <div>
              <span className="font-medium">Claim:</span> {citation.claim}
            </div>
            <div>
              <span className="font-medium">Value:</span> {citation.value}
              {citation.unit ? ` ${citation.unit}` : ""}
            </div>
            <div>
              <span className="font-medium">Captured:</span> {new Date(citation.capturedAt).toLocaleDateString()}
            </div>
            {citation.url ? (
              <a className="font-medium text-teal-700 hover:text-teal-900" href={citation.url} target="_blank" rel="noopener noreferrer">
                Source URL
              </a>
            ) : (
              <div className="text-zinc-500">No external URL. This source is not presented as live web evidence.</div>
            )}
            {citation.evidenceId ? (
              <div className="mt-2">
                <Link className="font-medium text-teal-700 hover:text-teal-900" href={`/evidence/${citation.evidenceId}`}>
                  Open evidence record
                </Link>
              </div>
            ) : null}
            {citation.notes ? <div className="mt-2 text-zinc-600">{citation.notes}</div> : null}
          </div>
        </details>
      ))}
    </div>
  );
}
