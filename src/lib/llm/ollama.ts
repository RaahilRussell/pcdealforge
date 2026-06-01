export type OllamaPolishRequest = {
  prompt: string;
  model?: string;
};

export type OllamaPolishResponse = {
  text: string;
  usedOllama: boolean;
  fallbackReason?: string;
};

export async function polishWithOllama({ prompt, model }: OllamaPolishRequest): Promise<OllamaPolishResponse> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const selectedModel = model ?? process.env.OLLAMA_MODEL ?? "llama3.1:8b";

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: selectedModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      return {
        text: "",
        usedOllama: false,
        fallbackReason: `Ollama returned HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as { response?: string };
    return {
      text: data.response ?? "",
      usedOllama: Boolean(data.response),
      fallbackReason: data.response ? undefined : "Ollama response was empty",
    };
  } catch (error) {
    return {
      text: "",
      usedOllama: false,
      fallbackReason: error instanceof Error ? error.message : "Ollama request failed",
    };
  }
}
