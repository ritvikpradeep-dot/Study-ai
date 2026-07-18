"use client";

import { useMemo } from "react";
import type { MindMapResult, MindMapNode } from "@/lib/mindmap-types";

const COL_WIDTH = 190;
const COL_GAP = 90;
const ROW_HEIGHT = 42;
const NODE_HEIGHT = 34;

type PositionedNode = { node: MindMapNode; x: number; y: number; depth: number };
type Edge = { fromX: number; fromY: number; toX: number; toY: number };

function layout(mindmap: MindMapResult) {
  const positioned: PositionedNode[] = [];
  const edges: Edge[] = [];

  // Each leaf gets one row slot; a branch's height/position is derived from
  // how many leaf slots its own children occupy (or 1 if it has none), so
  // branches with more sub-points get proportionally more vertical room.
  let cursor = 0;
  const branchSlots = mindmap.children.map((branch) => Math.max(1, branch.children?.length ?? 0));
  const totalSlots = branchSlots.reduce((a, b) => a + b, 0);

  const topicX = 0;
  const branchX = COL_WIDTH + COL_GAP;
  const leafX = (COL_WIDTH + COL_GAP) * 2;

  mindmap.children.forEach((branch, i) => {
    const slots = branchSlots[i];
    const bandTop = cursor * ROW_HEIGHT;
    const bandHeight = slots * ROW_HEIGHT;
    const branchY = bandTop + bandHeight / 2;

    positioned.push({ node: branch, x: branchX, y: branchY, depth: 1 });

    const leaves = branch.children?.length ? branch.children : [];
    leaves.forEach((leaf, j) => {
      const leafY = bandTop + j * ROW_HEIGHT + ROW_HEIGHT / 2;
      positioned.push({ node: leaf, x: leafX, y: leafY, depth: 2 });
      edges.push({ fromX: branchX + COL_WIDTH, fromY: branchY, toX: leafX, toY: leafY });
    });

    cursor += slots;
  });

  const totalHeight = Math.max(totalSlots * ROW_HEIGHT, ROW_HEIGHT);
  const topicY = totalHeight / 2;
  positioned.unshift({ node: { label: mindmap.topic }, x: topicX, y: topicY, depth: 0 });
  mindmap.children.forEach((_, i) => {
    const branchPos = positioned.find((p) => p.depth === 1 && p.node === mindmap.children[i]);
    if (branchPos) {
      edges.unshift({ fromX: topicX + COL_WIDTH, fromY: topicY, toX: branchX, toY: branchPos.y });
    }
  });

  const totalWidth = leafX + COL_WIDTH;
  return { positioned, edges, totalWidth, totalHeight };
}

const DEPTH_STYLE = [
  "bg-accent text-accent-foreground font-medium",
  "bg-accent/15 text-current font-medium",
  "bg-black/5 dark:bg-white/10 text-current",
];

export function MindMapView({ mindmap }: { mindmap: MindMapResult }) {
  const { positioned, edges, totalWidth, totalHeight } = useMemo(() => layout(mindmap), [mindmap]);

  return (
    <div className="glass flex-1 overflow-auto rounded-2xl p-6">
      <div className="relative" style={{ width: totalWidth, height: totalHeight, minHeight: NODE_HEIGHT }}>
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          {edges.map((e, i) => {
            const midX = (e.fromX + e.toX) / 2;
            return (
              <path
                key={i}
                d={`M ${e.fromX} ${e.fromY} C ${midX} ${e.fromY}, ${midX} ${e.toY}, ${e.toX} ${e.toY}`}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.25}
                strokeWidth={1.5}
              />
            );
          })}
        </svg>
        {positioned.map((p, i) => (
          <div
            key={i}
            className={`absolute flex items-center rounded-xl px-3 py-1.5 text-xs leading-snug shadow-sm ${DEPTH_STYLE[p.depth]}`}
            style={{
              left: p.x,
              top: p.y,
              width: COL_WIDTH,
              minHeight: NODE_HEIGHT,
              transform: "translateY(-50%)",
            }}
          >
            {p.node.label}
          </div>
        ))}
      </div>
    </div>
  );
}
