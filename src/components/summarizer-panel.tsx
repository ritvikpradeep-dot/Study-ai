"use client";

import { useState } from "react";
import { Users, RefreshCw } from "lucide-react";
import { MindMapView } from "@/components/mindmap-view";
import type { MindMapResult } from "@/lib/mindmap-types";
import { useToast } from "@/components/ui/toast";

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

export function SummarizerPanel({
  documentId,
  teamId,
  isHost,
  initialSharedSummary,
  initialSummaryGeneratedAt,
}: {
  documentId: string;
  teamId: string | null;
  isHost: boolean;
  initialSharedSummary: string | null;
  initialSummaryGeneratedAt: string | null;
}) {
  const viewOptions = teamId
    ? ([
        { value: "shared", label: "Shared" },
        { value: "text", label: "My summary" },
        { value: "mindmap", label: "Mind map" },
      ] as const)
    : ([
        { value: "text", label: "Text" },
        { value: "mindmap", label: "Mind map" },
      ] as const);

  const [view, setView] = useState<"text" | "mindmap" | "shared">(teamId ? "shared" : "text");
  const toast = useToast();
  const [sharedSummary, setSharedSummary] = useState(initialSharedSummary);
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState(initialSummaryGeneratedAt);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [length, setLength] = useState("medium");
  const [customPercent, setCustomPercent] = useState(30);
  const [style, setStyle] = useState("paragraph");
  const [options, setOptions] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mindmap, setMindmap] = useState<MindMapResult | null>(null);
  const [mindmapLoading, setMindmapLoading] = useState(false);
  const [mindmapError, setMindmapError] = useState<string | null>(null);

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

  const generateMindmap = async () => {
    setMindmapLoading(true);
    setMindmapError(null);

    const res = await fetch(`/api/documents/${documentId}/mindmap`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMindmapError(data.error || "Failed to generate mind map.");
      setMindmapLoading(false);
      return;
    }
    setMindmap(data.mindmap);
    setMindmapLoading(false);
  };

  const generateSharedSummary = async () => {
    setSharedLoading(true);
    const res = await fetch(`/api/documents/${documentId}/summary`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.show(data.error || "Failed to generate summary.", "error");
      setSharedLoading(false);
      return;
    }
    setSharedSummary(data.summary);
    setSummaryGeneratedAt(data.summaryGeneratedAt);
    setSharedLoading(false);
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-1">
      <div className="flex gap-1 rounded-xl bg-black/5 dark:bg-white/10 p-1">
        {viewOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setView(opt.value)}
            className={`flex-1 rounded-lg py-1.5 text-sm transition ${
              view === opt.value ? "bg-white dark:bg-black shadow" : "opacity-60"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {view === "shared" ? (
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          {isHost && (
            <button
              onClick={generateSharedSummary}
              disabled={sharedLoading}
              className="flex items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {sharedSummary ? <RefreshCw size={14} /> : <Users size={14} />}
              {sharedLoading ? "Generating…" : sharedSummary ? "Regenerate shared summary" : "Generate shared summary"}
            </button>
          )}
          {sharedSummary ? (
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {summaryGeneratedAt && (
                <p className="px-1 text-xs opacity-50">
                  Generated {new Date(summaryGeneratedAt).toLocaleString()}
                </p>
              )}
              <div className="glass whitespace-pre-wrap rounded-2xl p-4 text-sm leading-relaxed">
                {sharedSummary}
              </div>
            </div>
          ) : (
            <p className="px-1 text-sm opacity-60">
              {isHost
                ? "The one summary every room member sees. Generate it once — regenerate any time."
                : "The host hasn't generated a shared summary for this room yet."}
            </p>
          )}
        </div>
      ) : view === "mindmap" ? (
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          <button
            onClick={generateMindmap}
            disabled={mindmapLoading}
            className="rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {mindmapLoading ? "Generating…" : mindmap ? "Regenerate mind map" : "Generate mind map"}
          </button>
          {mindmapError && <p className="whitespace-pre-wrap text-sm text-red-500">{mindmapError}</p>}
          {mindmap ? (
            <MindMapView mindmap={mindmap} />
          ) : (
            !mindmapLoading && (
              <p className="px-1 text-sm opacity-60">
                Turns the document into a node diagram — a central topic branching into key points.
              </p>
            )
          )}
        </div>
      ) : (
        <>
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide opacity-60">Length</p>
        <div className="flex flex-wrap gap-1.5">
          {LENGTH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLength(opt.value)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                length === opt.value
                  ? "bg-accent text-accent-foreground"
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
                  ? "bg-accent text-accent-foreground"
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
                  ? "bg-accent text-accent-foreground"
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
        className="rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Generating…" : "Generate summary"}
      </button>

      {error && <p className="whitespace-pre-wrap text-sm text-red-500">{error}</p>}

      {summary && (
        <div className="glass flex-1 whitespace-pre-wrap rounded-2xl p-4 text-sm leading-relaxed">
          {summary}
        </div>
      )}
        </>
      )}
    </div>
  );
}
