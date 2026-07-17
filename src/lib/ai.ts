import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

let client: OpenAI | null = null;

export type AiUsage = { promptTokens: number | null; completionTokens: number | null };

export async function logAiUsage(params: {
  userId: string;
  documentId?: string;
  feature: "chat" | "summarize" | "quiz_generate" | "quiz_grade";
  usage?: AiUsage;
}) {
  await prisma.aiUsageLog
    .create({
      data: {
        userId: params.userId,
        documentId: params.documentId,
        feature: params.feature,
        model: AI_MODEL,
        promptTokens: params.usage?.promptTokens ?? null,
        completionTokens: params.usage?.completionTokens ?? null,
      },
    })
    // Analytics logging must never break the actual AI feature it's attached to.
    .catch(() => {});
}

export function isAiConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

export function getAiClient(): OpenAI {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set. Add it to .env.local to enable AI features.");
  }
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return client;
}

export const AI_MODEL = "llama-3.3-70b-versatile";

// Truncate to a safe character budget so we stay well within context limits
// while still giving the model the whole document for most study PDFs.
export function clampDocumentText(text: string, maxChars = 120_000) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[...document truncated for length...]";
}

// The model sometimes wraps JSON in markdown code fences despite instructions not to.
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
  onUsage?: (usage: AiUsage) => void;
}): Promise<T> {
  const ai = getAiClient();
  const completion = await ai.chat.completions.create({
    model: AI_MODEL,
    max_tokens: params.maxTokens ?? 6000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${params.system}\n\nRespond with ONLY the raw JSON object — no markdown code fences, no commentary before or after.`,
      },
      { role: "user", content: params.user },
    ],
  });

  params.onUsage?.({
    promptTokens: completion.usage?.prompt_tokens ?? null,
    completionTokens: completion.usage?.completion_tokens ?? null,
  });

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
  onUsage?: (usage: AiUsage) => void;
}): Promise<string> {
  const ai = getAiClient();
  const completion = await ai.chat.completions.create({
    model: AI_MODEL,
    max_tokens: params.maxTokens ?? 3000,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
  });
  params.onUsage?.({
    promptTokens: completion.usage?.prompt_tokens ?? null,
    completionTokens: completion.usage?.completion_tokens ?? null,
  });
  return completion.choices[0]?.message?.content ?? "";
}

export async function* streamText(params: {
  system: string;
  contents: { role: "user" | "model"; text: string }[];
  maxTokens?: number;
}): AsyncGenerator<string, AiUsage> {
  const ai = getAiClient();
  const messages = [
    { role: "system" as const, content: params.system },
    ...params.contents.map((c) => ({
      role: c.role === "model" ? ("assistant" as const) : ("user" as const),
      content: c.text,
    })),
  ];

  // Not every OpenAI-compatible provider this app has swapped between (see
  // src/lib/ai.ts history / handoff doc) accepts stream_options.include_usage
  // — some reject unknown request fields outright. Try it for token-usage
  // analytics, but fall back to a plain stream if the provider rejects it, so
  // an analytics addition can never break chat/summarize.
  let stream;
  try {
    stream = await ai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: params.maxTokens ?? 6000,
      stream: true,
      stream_options: { include_usage: true },
      messages,
    });
  } catch {
    stream = await ai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: params.maxTokens ?? 6000,
      stream: true,
      messages,
    });
  }

  let usage: AiUsage = { promptTokens: null, completionTokens: null };
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
    if (chunk.usage) {
      usage = {
        promptTokens: chunk.usage.prompt_tokens ?? null,
        completionTokens: chunk.usage.completion_tokens ?? null,
      };
    }
  }
  return usage;
}
