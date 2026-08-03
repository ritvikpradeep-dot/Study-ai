import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

// Per-page struggle intensity for one document: only reads highlights and
// dwell rows, both of which are already scoped to opted-in rooms — dwell
// rows are never written for non-sharing rooms (see the dwell route), and
// highlights on a non-sharing room's document simply aren't surfaced here.
// Aggregates are counts/sums only; no author identity is returned.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      pageCount: true,
      team: { select: { id: true, name: true, shareStruggleData: true } },
    },
  });
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!document.team?.shareStruggleData) {
    return NextResponse.json(
      { error: "This document's room hasn't opted into struggle-data sharing." },
      { status: 400 }
    );
  }

  const [highlights, dwells] = await Promise.all([
    prisma.highlight.findMany({
      where: { documentId: id },
      select: { page: true, startOffset: true, endOffset: true },
    }),
    prisma.pageDwell.findMany({
      where: { documentId: id },
      select: { page: true, userId: true, seconds: true },
    }),
  ]);

  const pageStats = new Map<
    number,
    { highlightCount: number; dwellSeconds: number; dwellUsers: Set<string>; passages: Map<string, number> }
  >();
  const getPage = (page: number) => {
    let entry = pageStats.get(page);
    if (!entry) {
      entry = { highlightCount: 0, dwellSeconds: 0, dwellUsers: new Set(), passages: new Map() };
      pageStats.set(page, entry);
    }
    return entry;
  };

  for (const h of highlights) {
    const entry = getPage(h.page);
    entry.highlightCount += 1;
    // Bucket by rounded offset range so near-identical selections across
    // different users/rooms cluster into the same passage instead of each
    // counting as a distinct one-off snippet.
    const bucket = `${Math.round(h.startOffset / 20) * 20}-${Math.round(h.endOffset / 20) * 20}`;
    entry.passages.set(bucket, (entry.passages.get(bucket) ?? 0) + 1);
  }
  for (const d of dwells) {
    const entry = getPage(d.page);
    entry.dwellSeconds += d.seconds;
    entry.dwellUsers.add(d.userId);
  }

  const maxHighlights = Math.max(1, ...[...pageStats.values()].map((p) => p.highlightCount));
  const maxDwell = Math.max(1, ...[...pageStats.values()].map((p) => p.dwellSeconds));

  const pages = [...pageStats.entries()]
    .map(([page, stats]) => {
      const topPassages = [...stats.passages.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([range, count]) => ({ range, count }));

      // Equal-weighted blend of highlight density and dwell time, each
      // normalized against this document's own max so intensity is relative,
      // not tied to an arbitrary absolute threshold.
      const intensity =
        0.5 * (stats.highlightCount / maxHighlights) + 0.5 * (stats.dwellSeconds / maxDwell);

      return {
        page,
        highlightCount: stats.highlightCount,
        dwellSeconds: stats.dwellSeconds,
        dwellMinutes: Math.round((stats.dwellSeconds / 60) * 10) / 10,
        distinctReaders: stats.dwellUsers.size,
        topPassages,
        intensity: Math.round(intensity * 100) / 100,
      };
    })
    .sort((a, b) => a.page - b.page);

  return NextResponse.json({
    document: { id: document.id, title: document.title, pageCount: document.pageCount },
    team: { id: document.team.id, name: document.team.name },
    pages,
  });
}
