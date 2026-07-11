"use client";

import { useState } from "react";

const LENGTH_OPTIONS = [
  { value: "one-sentence", label: "One sentence" },
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "detailed", label: "Detailed" },
  { value: "comprehensive", label: "Comprehensive" },
  { value: "custom", label: "Custom %" },
];

const STYLE_OPTIONS = [
  { value: "bullet", label: "Bullet points" },
  { value: "paragraph", label: "Paragraph" },
  { value: "outline", label: "Outline" },
  { value: "study-notes", label: "Study notes" },
  { value: "timeline", label: "Timeline" },
  { value: "chapter-wise", label: "Chapter-wise" },
  { value: "topic-wise", label: "Topic-wise" },
];

const EXTRA_OPTIONS = [
  { value: "definitions", label: "Definitions" },
  { value: "examples", label: "Examples" },
  { value: "formulas", label: "Formulas" },
  { value: "dates", label: "Important dates" },
  { value: "keyTerms", label: "Key terms" },
  { value: "explainSimply", label: "Explain simply" },
];

export function SummarizerPanel({ documentId }: { documentId: string }) {
  const [length, setLength] = useState("medium");
  const [customPercent, setCustomPercent] = useState(30);
  const [style, setStyle] = useState("paragraph");
  const [options, setOptions] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleOption = (value: string) => {
    setOptions((prev) => (prev.includes(value) ? prev.filter((o) => o !== value) : [...prev, value]));
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    setSummary("");

    const res = await fetch(`/api/documents/${documentId}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        length: length === "custom" ? undefined : length,
        customPercent: length === "custom" ? customPercent : undefined,
        style,
        options,
      }),
    });

    if (!res.ok || !res.body) {
      setError(await res.text());
      setLoading(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      setSummary((prev) => prev + decoder.decode(value, { stream: true }));
    }
    setLoading(false);
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-1">
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide opacity-60">Length</p>
        <div className="flex flex-wrap gap-1.5">
          {LENGTH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLength(opt.value)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                length === opt.value
                  ? "bg-indigo-600 text-white"
                  : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {length === "custom" && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="range"
              min={10}
              max={100}
              value={customPercent}
              onChange={(e) => setCustomPercent(Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-10 text-xs tabular-nums">{customPercent}%</span>
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide opacity-60">Style</p>
        <div className="flex flex-wrap gap-1.5">
          {STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStyle(opt.value)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                style === opt.value
                  ? "bg-indigo-600 text-white"
                  : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide opacity-60">Extras</p>
        <div className="flex flex-wrap gap-1.5">
          {EXTRA_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleOption(opt.value)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                options.includes(opt.value)
                  ? "bg-indigo-600 text-white"
                  : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={generate}
        disabled={loading}
        className="rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {loading ? "Generating…" : "Generate summary"}
      </button>

      {error && <p className="whitespace-pre-wrap text-sm text-red-500">{error}</p>}

      {summary && (
        <div className="glass flex-1 whitespace-pre-wrap rounded-2xl p-4 text-sm leading-relaxed">
          {summary}
        </div>
      )}
    </div>
  );
}
