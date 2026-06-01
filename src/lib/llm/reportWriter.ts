import { polishWithOllama } from "./ollama";

export type ReportPolishInput = {
  deterministicReport: string;
  deterministicVerdicts: Record<string, string>;
  citations: Array<{
    citationNumber: number;
    title: string;
    sourceType: string;
    claim: string;
    value: string;
  }>;
};

export type ReportPolishOutput = {
  prose: string;
  usedOllama: boolean;
  fallbackReason?: string;
};

export const ollamaGuardrailPrompt =
  "You are only rewriting the provided facts. Do not add new claims, sources, prices, benchmarks, release dates, or compatibility conclusions. Preserve all warnings and citations.";

export async function polishReport(input: ReportPolishInput): Promise<ReportPolishOutput> {
  const prompt = buildPolishPrompt(input);
  const response = await polishWithOllama({ prompt });

  if (!response.usedOllama || !response.text) {
    return {
      prose: input.deterministicReport,
      usedOllama: false,
      fallbackReason: response.fallbackReason ?? "Ollama unavailable",
    };
  }

  return {
    prose: response.text,
    usedOllama: true,
  };
}

export function buildPolishPrompt(input: ReportPolishInput) {
  return [
    ollamaGuardrailPrompt,
    "",
    "Deterministic verdicts:",
    JSON.stringify(input.deterministicVerdicts, null, 2),
    "",
    "Citations:",
    JSON.stringify(input.citations, null, 2),
    "",
    "Rewrite this report into clear prose without changing facts:",
    input.deterministicReport,
  ].join("\n");
}
