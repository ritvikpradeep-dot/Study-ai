"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import type { Channel } from "pusher-js";
import { Pencil, Square, Circle, ArrowUpRight, Eraser, Highlighter } from "lucide-react";
import { colorForAuthor } from "@/lib/annotation-colors";
import { useTeamChannel } from "@/hooks/use-team-channel";
import { throttle } from "@/lib/throttle";

type Point = { x: number; y: number };
type Tool = "PEN" | "RECTANGLE" | "CIRCLE" | "ARROW";
type ToolOrEraser = Tool | "ERASER";
type PenType = "PEN" | "HIGHLIGHTER" | "MARKER";
type DrawingItem = {
  id: string;
  page: number;
  tool: Tool;
  penType: PenType;
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

const PEN_TYPES: { value: PenType; label: string; icon: typeof Pencil }[] = [
  { value: "PEN", label: "Pen", icon: Pencil },
  { value: "HIGHLIGHTER", label: "Highlighter", icon: Highlighter },
  { value: "MARKER", label: "Marker", icon: Pencil },
];

const THICKNESS_PRESETS: { value: number; label: string }[] = [
  { value: 2, label: "Thin" },
  { value: 4, label: "Medium" },
  { value: 8, label: "Thick" },
];

const ERASE_RADIUS = 0.02; // fraction of page width — a point "near" a stroke

// penType controls how the base strokeWidth/color are rendered: a highlighter
// is wide, semi-transparent, and blends with what's underneath (like a real
// highlighter over text); a marker is thicker and fully opaque; a plain pen
// draws the stroke width as-is.
function applyPenTypeStyle(ctx: CanvasRenderingContext2D, penType: PenType, strokeWidth: number) {
  if (penType === "HIGHLIGHTER") {
    ctx.globalAlpha = 0.35;
    ctx.globalCompositeOperation = "multiply";
    ctx.lineWidth = strokeWidth * 3;
  } else if (penType === "MARKER") {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = strokeWidth * 2;
  } else {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = strokeWidth;
  }
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  d: { tool: Tool; penType: PenType; pathData: Point[]; color: string; strokeWidth: number },
  width: number,
  height: number
) {
  const pts = d.pathData.map((p) => ({ x: p.x * width, y: p.y * height }));
  if (pts.length < 2) return;
  ctx.strokeStyle = d.color;
  applyPenTypeStyle(ctx, d.penType, d.strokeWidth);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (d.tool === "PEN") {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  } else {
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

  // Reset so later strokes on the same context aren't affected.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function distanceToStroke(point: Point, d: { pathData: Point[] }) {
  let min = Infinity;
  for (const p of d.pathData) {
    const dist = Math.hypot(point.x - p.x, point.y - p.y);
    if (dist < min) min = dist;
  }
  return min;
}

type RemoteStroke = {
  tool: Tool;
  penType: PenType;
  pathData: Point[];
  color: string;
  strokeWidth: number;
};

export function DrawingCanvas({
  documentId,
  page,
  width,
  height,
  active,
  teamId = null,
  onPinchZoom,
  onPan,
}: {
  documentId: string;
  page: number;
  width: number;
  height: number;
  active: boolean;
  teamId?: string | null;
  onPinchZoom?: (scaleFactor: number) => void;
  onPan?: (dx: number, dy: number) => void;
}) {
  const { data: session } = useSession();
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const [remoteStrokes, setRemoteStrokes] = useState<Record<string, RemoteStroke>>({});
  const remoteStrokeTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [tool, setTool] = useState<ToolOrEraser>("PEN");
  const [penType, setPenType] = useState<PenType>("PEN");
  const [strokeWidth, setStrokeWidth] = useState(4);
  // Defaults to the author's assigned color; null once the user picks their
  // own via the color input. Derived rather than synced from session in an
  // effect, since it's a pure function of already-available state.
  const [userColor, setUserColor] = useState<string | null>(null);
  const color = userColor ?? (session?.user?.id ? colorForAuthor(session.user.id) : "#f59e0b");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef<Point[] | null>(null);
  const isPointerDown = useRef(false);
  // Tracks concurrently-down pointers so two-finger touch is treated as
  // pinch-zoom/pan instead of drawing a stroke.
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchState = useRef<{ distance: number; midX: number; midY: number } | null>(null);

  useEffect(() => {
    fetch(`/api/documents/${documentId}/drawings`)
      .then((r) => r.json())
      .then((data) => setDrawings(data.drawings ?? []))
      .catch(() => setDrawings([]));
  }, [documentId]);

  const handleChannel = useCallback(
    (channel: Channel) => {
      channel.bind(
        "stroke-preview",
        (data: {
          documentId: string;
          page: number;
          authorId: string;
          tool: Tool;
          penType: PenType;
          pathData: Point[];
          color: string;
          strokeWidth: number;
        }) => {
          if (data.documentId !== documentId || data.page !== page || data.authorId === session?.user?.id) return;
          setRemoteStrokes((prev) => ({
            ...prev,
            [data.authorId]: {
              tool: data.tool,
              penType: data.penType,
              pathData: data.pathData,
              color: data.color,
              strokeWidth: data.strokeWidth,
            },
          }));
          if (remoteStrokeTimeouts.current[data.authorId]) clearTimeout(remoteStrokeTimeouts.current[data.authorId]);
          remoteStrokeTimeouts.current[data.authorId] = setTimeout(() => {
            setRemoteStrokes((prev) => {
              const next = { ...prev };
              delete next[data.authorId];
              return next;
            });
          }, 2000);
        }
      );
      channel.bind(
        "drawing-added",
        (data: { documentId: string; drawing: DrawingItem }) => {
          if (data.documentId !== documentId || data.drawing.authorId === session?.user?.id) return;
          setRemoteStrokes((prev) => {
            const next = { ...prev };
            delete next[data.drawing.authorId];
            return next;
          });
          setDrawings((prev) =>
            prev.some((d) => d.id === data.drawing.id) ? prev : [...prev, { ...data.drawing, isMine: false }]
          );
        }
      );
      channel.bind(
        "drawing-deleted",
        (data: { documentId: string; drawingId: string }) => {
          if (data.documentId !== documentId) return;
          setDrawings((prev) => prev.filter((d) => d.id !== data.drawingId));
        }
      );
    },
    [documentId, page, session?.user?.id]
  );

  useTeamChannel(teamId, handleChannel);

  const broadcastStrokePreview = useMemo(
    () =>
      throttle((points: Point[]) => {
        if (!teamId) return;
        fetch(`/api/documents/${documentId}/stroke-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page, pathData: points, tool, penType, color, strokeWidth }),
        }).catch(() => {});
      }, 150),
    [teamId, documentId, page, tool, penType, color, strokeWidth]
  );

  const pageDrawings = drawings.filter((d) => d.page === page);

  const redraw = useCallback(
    (inProgress?: { tool: Tool; penType: PenType; pathData: Point[]; color: string; strokeWidth: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (const d of pageDrawings) drawStroke(ctx, d, width, height);
      for (const stroke of Object.values(remoteStrokes)) drawStroke(ctx, stroke, width, height);
      if (inProgress) drawStroke(ctx, inProgress, width, height);
    },
    [pageDrawings, remoteStrokes, width, height]
  );

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawings, remoteStrokes, page, width, height]);

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
    if (!active || tool === "ERASER") return;
    isPointerDown.current = true;
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = [toFraction(e)];
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
    redraw({ tool, penType, pathData: drawingRef.current, color, strokeWidth });
    broadcastStrokePreview(drawingRef.current);
  };

  const onPointerUp = async () => {
    if (!active || tool === "ERASER") return;
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
      body: JSON.stringify({ tool, penType, page, pathData: points, color, strokeWidth }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.drawing) {
      setDrawings((prev) => [
        ...prev,
        {
          id: data.drawing.id,
          page: data.drawing.page,
          tool: data.drawing.tool,
          penType: data.drawing.penType,
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

  function pinchMetrics(map: Map<number, { x: number; y: number }>) {
    const [a, b] = Array.from(map.values());
    return { distance: Math.hypot(b.x - a.x, b.y - a.y), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 };
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.current.size >= 2) {
      // A second finger landed mid-stroke: abandon the stroke and switch to pinch/pan.
      isPointerDown.current = false;
      drawingRef.current = null;
      redraw();
      pinchState.current = pinchMetrics(activePointers.current);
      return;
    }
    onPointerDown(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (activePointers.current.size >= 2 && pinchState.current) {
      const next = pinchMetrics(activePointers.current);
      if (onPinchZoom && pinchState.current.distance > 0) {
        onPinchZoom(next.distance / pinchState.current.distance);
      }
      onPan?.(next.midX - pinchState.current.midX, next.midY - pinchState.current.midY);
      pinchState.current = next;
      return;
    }
    onPointerMove(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchState.current = null;
    if (activePointers.current.size === 0) onPointerUp();
  };

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
          // Without this, mobile browsers claim single-finger touches for
          // scrolling before pointer events fire, so strokes pan the page
          // instead of drawing. Pinch/pan while drawing is reimplemented via
          // the two-pointer handlers above.
          touchAction: active ? "none" : "auto",
          cursor: active ? (isEraser ? "cell" : "crosshair") : "default",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={isEraser ? onEraserClick : undefined}
      />
      {active && (
        <div className="glass absolute left-2 top-2 z-10 flex flex-col gap-1.5 rounded-xl p-1.5 shadow-lg">
          <div className="flex gap-1">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => setTool(t.value)}
                  title={t.label}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg transition ${
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
              className={`flex h-11 w-11 items-center justify-center rounded-lg transition ${
                isEraser ? "bg-accent text-accent-foreground" : "hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <Eraser size={15} />
            </button>
          </div>

          {!isEraser && (
            <>
              <div className="mx-0.5 h-px bg-black/10 dark:bg-white/10" />
              <div className="flex gap-1">
                {PEN_TYPES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPenType(p.value)}
                    title={p.label}
                    className={`flex-1 rounded-lg px-1.5 py-1 text-[10px] transition ${
                      penType === p.value ? "bg-accent text-accent-foreground" : "hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {THICKNESS_PRESETS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setStrokeWidth(t.value)}
                    title={t.label}
                    className={`flex-1 rounded-lg px-1.5 py-1 text-[10px] transition ${
                      strokeWidth === t.value ? "bg-accent text-accent-foreground" : "hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <input
                type="color"
                value={color}
                onChange={(e) => setUserColor(e.target.value)}
                title="Color"
                className="h-7 w-full cursor-pointer rounded-lg border border-black/10 bg-transparent dark:border-white/10"
              />
            </>
          )}
        </div>
      )}
    </>
  );
}
