"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Flame } from "lucide-react";

type PageStat = {
  page: number;
  highlightCount: number;
  dwellMinutes: number;
  distinctReaders: number;
  topPassages: { range: string; count: number }[];
  intensity: number;
};

type HeatmapData = {
  document: { id: string; title: string; pageCount: number | null };
  team: { id: string; name: string };
  pages: PageStat[];
};

export function HeatmapView({ documentId }: { documentId: string }) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/documents/${documentId}/heatmap`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Failed to load heatmap.");
        return json as HeatmapData;
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [documentId]);

  if (error) return <Card className="p-5 text-sm text-red-500">{error}</Card>;
  if (!data) return <Card className="p-5 text-sm opacity-60">Loading heatmap…</Card>;

  if (data.pages.length === 0) {
    return (
      <Card className="p-5 text-sm opacity-70">
        No highlights or reading-time signal recorded yet for this document.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Flame size={20} className="text-accent" /> {data.document.title}
        </h1>
        <p className="mt-1 text-sm opacity-70">
          Struggle heatmap for &ldquo;{data.team.name}&rdquo; · aggregated from{" "}
          {data.pages.reduce((s, p) => s + p.highlightCount, 0)} highlights and{" "}
          {Math.round(data.pages.reduce((s, p) => s + p.dwellMinutes, 0))} minutes of reading time,
          anonymized across all readers — no individual student is identified below.
        </p>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-8 gap-2 sm:grid-cols-10 md:grid-cols-12">
          {data.pages.map((p) => (
            <div
              key={p.page}
              title={`Page ${p.page}: ${p.highlightCount} highlights, ${p.dwellMinutes}m reading time, ${p.distinctReaders} readers`}
              className="flex aspect-square flex-col items-center justify-center rounded-lg text-xs font-medium"
              style={{
                backgroundColor: `color-mix(in srgb, var(--accent) ${Math.round(p.intensity * 90) + 10}%, transparent)`,
                color: p.intensity > 0.5 ? "var(--accent-foreground)" : "var(--foreground)",
              }}
            >
              {p.page}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs opacity-50">
          Darker = more highlights and lingering time on that page, relative to this document&apos;s
          own pages. Hover a page for its numbers.
        </p>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide opacity-60 dark:border-white/10">
              <th className="px-4 py-3 font-medium">Page</th>
              <th className="px-4 py-3 font-medium">Highlights</th>
              <th className="px-4 py-3 font-medium">Reading time</th>
              <th className="px-4 py-3 font-medium">Readers</th>
              <th className="px-4 py-3 font-medium">Most-highlighted passages</th>
            </tr>
          </thead>
          <tbody>
            {[...data.pages]
              .sort((a, b) => b.intensity - a.intensity)
              .map((p) => (
                <tr key={p.page} className="border-b border-black/5 last:border-0 dark:border-white/5">
                  <td className="px-4 py-3 font-medium">{p.page}</td>
                  <td className="px-4 py-3">{p.highlightCount}</td>
                  <td className="px-4 py-3">{p.dwellMinutes}m</td>
                  <td className="px-4 py-3">{p.distinctReaders}</td>
                  <td className="px-4 py-3 text-xs opacity-70">
                    {p.topPassages.length === 0
                      ? "—"
                      : p.topPassages.map((tp) => `${tp.count}×`).join(", ")}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
