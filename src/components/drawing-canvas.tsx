"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import type { Channel } from "pusher-js";
import { Pencil, Square, Circle, ArrowUpRight, Eraser, Highlighter, ChevronsLeft, GripHorizontal } from "lucide-react";
import { colorForAuthor } from "@/lib/annotation-colors";
import { useTeamChannel } from "@/hooks/use-team-channel";
import { throttle } from "@/lib/throttle";
import { useInterfaceMode } from "@/lib/interface-mode";

const TOOLBAR_MARGIN = 8; // px kept clear from the viewport edge when clamping
const DEFAULT_TOOLBAR_POSITION = { x: 16, y: 88 }; // clears the sticky navbar

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
  // Collapsing the panel is independent of drawing being active — closing it
  // must never turn off the pen tool, since there was previously no way to
  // see the covered part of the document without losing the tool entirely.
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const { mode } = useInterfaceMode();
  const isMobile = mode === "mobile";
  const panelRef = useRef<HTMLDivElement>(null);
  const [toolbarPosition, setToolbarPosition] = useState(DEFAULT_TOOLBAR_POSITION);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const positionStorageKey = session?.user?.id ? `nous:drawToolbarPos:${session.user.id}` : null;
  const collapsedStorageKey = session?.user?.id ? `nous:drawToolbarCollapsed:${session.user.id}` : null;

  const clampToolbarPosition = useCallback((pos: { x: number; y: number }) => {
    const rect = panelRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 200;
    const h = rect?.height ?? 44;
    const maxX = Math.max(TOOLBAR_MARGIN, window.innerWidth - w - TOOLBAR_MARGIN);
    const maxY = Math.max(TOOLBAR_MARGIN, window.innerHeight - h - TOOLBAR_MARGIN);
    return {
      x: Math.min(Math.max(pos.x, TOOLBAR_MARGIN), maxX),
      y: Math.min(Math.max(pos.y, TOOLBAR_MARGIN), maxY),
    };
  }, []);

  // Restore this user's last position/collapsed state — same localStorage
  // pattern already used elsewhere in the app for per-browser preferences
  // (accent color, sidebar collapse), scoped by userId so two accounts
  // signed into the same browser don't clobber each other's toolbar spot.
  useEffect(() => {
    if (!positionStorageKey) return;
    try {
      const raw = localStorage.getItem(positionStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          setToolbarPosition(clampToolbarPosition(parsed));
        }
      }
    } catch {
      // Ignore malformed/blocked storage — falls back to the default position.
    }
  }, [positionStorageKey, clampToolbarPosition]);

  useEffect(() => {
    if (!collapsedStorageKey) return;
    try {
      const raw = localStorage.getItem(collapsedStorageKey);
      if (raw != null) setPanelCollapsed(raw === "1");
    } catch {
      // Ignore — defaults to expanded.
    }
  }, [collapsedStorageKey]);

  useEffect(() => {
    if (!collapsedStorageKey) return;
    try {
      localStorage.setItem(collapsedStorageKey, panelCollapsed ? "1" : "0");
    } catch {
      // Best-effort only.
    }
  }, [panelCollapsed, collapsedStorageKey]);

  // Keep the toolbar on-screen if the window is resized/rotated.
  useEffect(() => {
    const onResize = () => setToolbarPosition((p) => clampToolbarPosition(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampToolbarPosition]);

  // Dragging only starts from the dedicated grip handle below, so it never
  // competes with the canvas's own drawing pointer handlers — the handle is
  // a separate element, not an overlay on top of the canvas.
  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: toolbarPosition.x,
      origY: toolbarPosition.y,
    };
  };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    e.stopPropagation();
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setToolbarPosition(clampToolbarPosition({ x: dragState.current.origX + dx, y: dragState.current.origY + dy }));
  };

  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    e.stopPropagation();
    dragState.current = null;
    setToolbarPosition((pos) => {
      if (positionStorageKey) {
        try {
          localStorage.setItem(positionStorageKey, JSON.stringify(pos));
        } catch {
          // Best-effort only.
        }
      }
      return pos;
    });
  };

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

  const toolButtons = (
    <>
      {TOOLS.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            onClick={() => setTool(t.value)}
            title={t.label}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition ${
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
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition ${
          isEraser ? "bg-accent text-accent-foreground" : "hover:bg-black/5 dark:hover:bg-white/10"
        }`}
      >
        <Eraser size={15} />
      </button>
    </>
  );

  const penTypeButtons = (
    <>
      {PEN_TYPES.map((p) => (
        <button
          key={p.value}
          onClick={() => setPenType(p.value)}
          title={p.label}
          className={`shrink-0 rounded-lg px-2 py-1.5 text-[10px] transition ${
            penType === p.value ? "bg-accent text-accent-foreground" : "hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          {p.label}
        </button>
      ))}
    </>
  );

  const thicknessButtons = (
    <>
      {THICKNESS_PRESETS.map((t) => (
        <button
          key={t.value}
          onClick={() => setStrokeWidth(t.value)}
          title={t.label}
          className={`shrink-0 rounded-lg px-2 py-1.5 text-[10px] transition ${
            strokeWidth === t.value ? "bg-accent text-accent-foreground" : "hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          {t.label}
        </button>
      ))}
    </>
  );

  const colorInput = (
    <input
      type="color"
      value={color}
      onChange={(e) => setUserColor(e.target.value)}
      title="Color"
      className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-black/10 bg-transparent dark:border-white/10"
    />
  );

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

      {/* Mobile: docked full-width bar just above the app's own bottom tab
          bar, never draggable — free-floating drag is awkward on a small
          touch screen and would fight with the tab bar underneath it. */}
      {active && isMobile && (
        panelCollapsed ? (
          <button
            onClick={() => setPanelCollapsed(false)}
            title="Show drawing tools"
            aria-label="Show drawing tools"
            className="glass fixed right-3 z-30 flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition hover:bg-black/5 dark:hover:bg-white/10"
            style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom) + 8px)" }}
          >
            <Pencil size={16} />
          </button>
        ) : (
          <div
            className="glass fixed inset-x-0 z-30 flex items-center gap-1 overflow-x-auto border-t px-2 py-2 shadow-lg"
            style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
          >
            <button
              onClick={() => setPanelCollapsed(true)}
              title="Collapse — keeps the pen tool active"
              aria-label="Collapse drawing tools"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              <ChevronsLeft size={15} />
            </button>
            {toolButtons}
            {!isEraser && (
              <>
                <div className="mx-1 h-8 w-px shrink-0 bg-black/10 dark:bg-white/10" />
                {penTypeButtons}
                {thicknessButtons}
                {colorInput}
              </>
            )}
          </div>
        )
      )}

      {/* Desktop/tablet: freely draggable floating panel, position persisted
          per-user in localStorage. */}
      {active && !isMobile && panelCollapsed && (
        <button
          onClick={() => setPanelCollapsed(false)}
          title="Show drawing tools"
          aria-label="Show drawing tools"
          className="glass fixed z-30 flex h-11 w-11 items-center justify-center rounded-xl shadow-lg transition hover:bg-black/5 dark:hover:bg-white/10"
          style={{ left: toolbarPosition.x, top: toolbarPosition.y }}
        >
          <Pencil size={16} />
        </button>
      )}
      {active && !isMobile && !panelCollapsed && (
        <div
          ref={panelRef}
          className="glass fixed z-30 flex flex-col gap-1.5 rounded-xl p-1.5 shadow-lg"
          style={{ left: toolbarPosition.x, top: toolbarPosition.y }}
        >
          <div
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
            title="Drag to move"
            className="flex h-5 cursor-grab items-center justify-center rounded-md hover:bg-black/5 active:cursor-grabbing dark:hover:bg-white/10"
            style={{ touchAction: "none" }}
          >
            <GripHorizontal size={14} className="opacity-50" />
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setPanelCollapsed(true)}
              title="Collapse — keeps the pen tool active"
              aria-label="Collapse drawing tools"
              className="flex h-11 w-11 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              <ChevronsLeft size={15} />
            </button>
            {toolButtons}
          </div>

          {!isEraser && (
            <>
              <div className="mx-0.5 h-px bg-black/10 dark:bg-white/10" />
              <div className="flex gap-1">{penTypeButtons}</div>
              <div className="flex gap-1">{thicknessButtons}</div>
              <div className="flex justify-center">{colorInput}</div>
            </>
          )}
        </div>
      )}
    </>
  );
}
