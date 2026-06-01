import { afterEach, describe, expect, it } from "vitest";

import { buildPolishPrompt, ollamaGuardrailPrompt, polishReport } from "./reportWriter";

const originalBaseUrl = process.env.OLLAMA_BASE_URL;

afterEach(() => {
  process.env.OLLAMA_BASE_URL = originalBaseUrl;
});

describe("Ollama report writer", () => {
  it("prompt forbids adding new claims", () => {
    const prompt = buildPolishPrompt({
      deterministicReport: "Verdict: WAIT_FOR_PRICE_DROP [1]",
      deterministicVerdicts: { timingVerdict: "WAIT_FOR_PRICE_DROP" },
      citations: [{ citationNumber: 1, title: "Seeded", sourceType: "seeded_demo", claim: "price", value: "$700" }],
    });

    expect(ollamaGuardrailPrompt).toContain("Do not add new claims");
    expect(prompt).toContain("Preserve all warnings and citations");
    expect(prompt).toContain("WAIT_FOR_PRICE_DROP");
  });

  it("falls back to deterministic report when Ollama is unavailable", async () => {
    process.env.OLLAMA_BASE_URL = "http://127.0.0.1:1";
    const result = await polishReport({
      deterministicReport: "Deterministic explanation [1]",
      deterministicVerdicts: { timingVerdict: "BUY_NOW" },
      citations: [{ citationNumber: 1, title: "Seeded", sourceType: "seeded_demo", claim: "timing", value: "BUY_NOW" }],
    });

    expect(result.usedOllama).toBe(false);
    expect(result.prose).toBe("Deterministic explanation [1]");
    expect(result.fallbackReason).toBeTruthy();
  });
});
