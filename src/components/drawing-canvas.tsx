"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Pencil, Square, Circle, ArrowUpRight, Eraser } from "lucide-react";
import { colorForAuthor } from "@/lib/annotation-colors";

type Point = { x: number; y: number };
type Tool = "PEN" | "RECTANGLE" | "CIRCLE" | "ARROW";
type ToolOrEraser = Tool | "ERASER";
type DrawingItem = {
  id: string;
  page: number;
  tool: Tool;
  pathData: Point[];
  color: string;
  strokeWidth: number;
  authorId: string;
  isMine: boolean;
};

const TOOLS: { value: Tool; label: string; icon: typeof Pencil }[] = [
  { value: "PEN", label: "Pen", icon: Pencil },
  { value: "RECTANGLE", label: "Rectangle", icon: Square },
  { value: "CIRCLE", label: "Circle", icon: Circle },
  { value: "ARROW", label: "Arrow", icon: ArrowUpRight },
];

const ERASE_RADIUS = 0.02; // fraction of page width — a point "near" a stroke

function drawStroke(ctx: CanvasRenderingContext2D, d: { tool: Tool; pathData: Point[]; color: string; strokeWidth: number }, width: number, height: number) {
  const pts = d.pathData.map((p) => ({ x: p.x * width, y: p.y * height }));
  if (pts.length < 2) return;
  ctx.strokeStyle = d.color;
  ctx.lineWidth = d.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (d.tool === "PEN") {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    return;
  }

  const [start, end] = [pts[0], pts[pts.length - 1]];
  if (d.tool === "RECTANGLE") {
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
  } else if (d.tool === "CIRCLE") {
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (d.tool === "ARROW") {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLen = 10 + d.strokeWidth;
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }
}

function distanceToStroke(point: Point, d: { pathData: Point[] }) {
  let min = Infinity;
  for (const p of d.pathData) {
    const dist = Math.hypot(point.x - p.x, point.y - p.y);
    if (dist < min) min = dist;
  }
  return min;
}

export function DrawingCanvas({
  documentId,
  page,
  width,
  height,
  active,
}: {
  documentId: string;
  page: number;
  width: number;
  height: number;
  active: boolean;
}) {
  const { data: session } = useSession();
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const [tool, setTool] = useState<ToolOrEraser>("PEN");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<Point[] | null>(null);
  const isPointerDown = useRef(false);

  const myColor = session?.user?.id ? colorForAuthor(session.user.id) : "#f59e0b";

  useEffect(() => {
    fetch(`/api/documents/${documentId}/drawings`)
      .then((r) => r.json())
      .then((data) => setDrawings(data.drawings ?? []))
      .catch(() => setDrawings([]));
  }, [documentId]);

  const pageDrawings = drawings.filter((d) => d.page === page);

  const redraw = useCallback(
    (inProgress?: { tool: Tool; pathData: Point[]; color: string; strokeWidth: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (const d of pageDrawings) drawStroke(ctx, d, width, height);
      if (inProgress) drawStroke(ctx, inProgress, width, height);
    },
    [pageDrawings, width, height]
  );

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawings, page, width, height]);

  const toFraction = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const deleteDrawing = async (id: string) => {
    setDrawings((prev) => prev.filter((d) => d.id !== id));
    await fetch(`/api/drawings/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return;
    isPointerDown.current = true;
    canvasRef.current?.setPointerCapture(e.pointerId);
    const point = toFraction(e);

    if (tool === "PEN" || tool === "RECTANGLE" || tool === "CIRCLE" || tool === "ARROW") {
      drawingRef.current = [point];
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active || !isPointerDown.current || tool === "ERASER") return;
    const point = toFraction(e);

    if (!drawingRef.current) return;
    if (tool === "PEN") {
      drawingRef.current = [...drawingRef.current, point];
    } else {
      drawingRef.current = [drawingRef.current[0], point];
    }
    redraw({ tool, pathData: drawingRef.current, color: myColor, strokeWidth: 3 });
  };

  const onPointerUp = async () => {
    if (!active) return;
    isPointerDown.current = false;
    const points = drawingRef.current;
    drawingRef.current = null;
    if (!points || points.length < 2) {
      redraw();
      return;
    }

    const res = await fetch(`/api/documents/${documentId}/drawings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, page, pathData: points }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.drawing) {
      setDrawings((prev) => [
        ...prev,
        {
          id: data.drawing.id,
          page: data.drawing.page,
          tool: data.drawing.tool,
          pathData: data.drawing.pathData,
          color: data.drawing.color,
          strokeWidth: data.drawing.strokeWidth,
          authorId: data.drawing.authorId,
          isMine: true,
        },
      ]);
    } else {
      redraw();
    }
  };

  const isEraser = tool === "ERASER";

  const onEraserClick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active || !isEraser) return;
    const point = toFraction(e);
    const hit = pageDrawings.find((d) => d.isMine && distanceToStroke(point, d) < ERASE_RADIUS);
    if (hit) deleteDrawing(hit.id);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute left-0 top-0"
        style={{
          pointerEvents: active ? "auto" : "none",
          cursor: active ? (isEraser ? "cell" : "crosshair") : "default",
        }}
        onPointerDown={isEraser ? undefined : onPointerDown}
        onPointerMove={isEraser ? undefined : onPointerMove}
        onPointerUp={isEraser ? undefined : onPointerUp}
        onClick={onEraserClick}
      />
      {active && (
        <div className="glass absolute left-2 top-2 z-10 flex gap-1 rounded-xl p-1 shadow-lg">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                onClick={() => setTool(t.value)}
                title={t.label}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                  tool === t.value ? "bg-accent text-accent-foreground" : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                <Icon size={15} />
              </button>
            );
          })}
          <button
            onClick={() => setTool("ERASER")}
            title="Eraser"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
              isEraser ? "bg-accent text-accent-foreground" : "hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            <Eraser size={15} />
          </button>
        </div>
      )}
    </>
  );
}
