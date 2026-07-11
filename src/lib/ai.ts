import OpenAI from "openai";

let client: OpenAI | null = null;

export function isAiConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function getAiClient(): OpenAI {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set. Add it to .env.local to enable AI features.");
  }
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }
  return client;
}

// Free-tier model on OpenRouter — no billing required.
export const AI_MODEL = "tencent/hy3:free";

// This model does internal chain-of-thought reasoning that counts against
// max_tokens. Keeping effort low leaves the budget for the actual answer
// instead of it being consumed by reasoning on long documents.
const LOW_REASONING = { reasoning: { effort: "low" } };

// Truncate to a safe character budget so we stay well within context limits
// while still giving the model the whole document for most study PDFs.
export function clampDocumentText(text: string, maxChars = 120_000) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[...document truncated for length...]";
}

// Models sometimes wrap JSON in markdown code fences, or add stray text around it,
// despite instructions not to. Extract the outermost JSON object defensively.
function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1];
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

export async function generateJson<T>(params: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  const ai = getAiClient();
  const requestBody = {
    model: AI_MODEL,
    max_tokens: params.maxTokens ?? 6000,
    messages: [
      {
        role: "system" as const,
        content: `${params.system}\n\nRespond with ONLY the raw JSON object — no markdown code fences, no commentary before or after.`,
      },
      { role: "user" as const, content: params.user },
    ],
    ...LOW_REASONING,
  };
  const completion = await ai.chat.completions.create(
    requestBody as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
  );

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Model did not return a text response.");

  const jsonText = extractJson(text);
  try {
    return JSON.parse(jsonText) as T;
  } catch {
    throw new Error("Model response wasn't valid JSON. Try again.");
  }
}

export async function generateText(params: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const ai = getAiClient();
  const requestBody = {
    model: AI_MODEL,
    max_tokens: params.maxTokens ?? 3000,
    messages: [
      { role: "system" as const, content: params.system },
      { role: "user" as const, content: params.user },
    ],
    ...LOW_REASONING,
  };
  const completion = await ai.chat.completions.create(
    requestBody as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
  );
  return completion.choices[0]?.message?.content ?? "";
}

export async function* streamText(params: {
  system: string;
  contents: { role: "user" | "model"; text: string }[];
  maxTokens?: number;
}): AsyncGenerator<string> {
  const ai = getAiClient();
  const requestBody = {
    model: AI_MODEL,
    max_tokens: params.maxTokens ?? 6000,
    stream: true as const,
    messages: [
      { role: "system" as const, content: params.system },
      ...params.contents.map((c) => ({
        role: c.role === "model" ? ("assistant" as const) : ("user" as const),
        content: c.text,
      })),
    ],
    ...LOW_REASONING,
  };
  const stream = await ai.chat.completions.create(
    requestBody as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming
  );

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
