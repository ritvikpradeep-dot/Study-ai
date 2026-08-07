"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, Thumbnail, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Search,
  PanelLeft,
  Maximize,
  Minimize,
  Highlighter,
  StickyNote,
  X,
  Pencil,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Channel } from "pusher-js";
import { Tooltip } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { DrawingCanvas } from "@/components/drawing-canvas";
import { StickyNoteLayer, type StickyNoteLayerHandle } from "@/components/sticky-note-layer";
import { ReactionBar, type ReactionItem } from "@/components/reaction-bar";
import { useTeamChannel } from "@/hooks/use-team-channel";
import { throttle } from "@/lib/throttle";
import { colorForAuthor } from "@/lib/annotation-colors";
import { useToast } from "@/components/ui/toast";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type HighlightItem = {
  id: string;
  page: number;
  textSnippet: string;
  color: string;
  authorId: string;
  authorName: string;
  isMine: boolean;
};

type RemoteCursor = { authorId: string; authorName: string; page: number; x: number; y: number };

function IconButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="flex h-11 w-11 items-center justify-center rounded-lg transition hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/10"
      >
        {children}
      </button>
    </Tooltip>
  );
}

// Escape a snippet for use inside a RegExp, matching the same approach as
// the existing search-highlight mechanism below.
function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function PdfViewer({
  documentId,
  pageCount,
  fullscreen = false,
  onToggleFullscreen,
  onAddToNotes,
  shared = false,
  canEdit = true,
  teamId = null,
}: {
  documentId: string;
  pageCount: number | null;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onAddToNotes?: (text: string, page: number) => void;
  shared?: boolean;
  canEdit?: boolean;
  teamId?: string | null;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [numPages, setNumPages] = useState<number>(pageCount ?? 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [searchText, setSearchText] = useState("");
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const cursorTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [selection, setSelection] = useState<{
    text: string;
    x: number;
    y: number;
    pageX: number;
    pageY: number;
  } | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [stickyMode, setStickyMode] = useState(false);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const pageWrapperRef = useRef<HTMLDivElement>(null);
  const stickyNoteLayerRef = useRef<StickyNoteLayerHandle>(null);

  const fileUrl = useMemo(() => `/api/documents/${documentId}/file`, [documentId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [documentId]);

  // Struggle-heatmap dwell tracking: accumulates seconds spent per page and
  // flushes periodically. The server silently no-ops for solo documents or
  // rooms that didn't opt into struggle-data sharing, so this can fire
  // unconditionally for any room document without knowing the sharing state.
  const dwellRef = useRef({ page: currentPage, seconds: 0 });
  const flushDwell = useCallback(() => {
    const { page, seconds } = dwellRef.current;
    dwellRef.current.seconds = 0;
    if (!teamId || seconds <= 0) return;
    fetch(`/api/documents/${documentId}/dwell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page, seconds }),
      keepalive: true,
    }).catch(() => {});
  }, [teamId, documentId]);

  useEffect(() => {
    flushDwell();
    dwellRef.current.page = currentPage;
  }, [currentPage, flushDwell]);

  useEffect(() => {
    if (!teamId) return;
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") dwellRef.current.seconds += 1;
    }, 1000);
    const flushTimer = setInterval(flushDwell, 10000);
    window.addEventListener("beforeunload", flushDwell);
    return () => {
      clearInterval(tick);
      clearInterval(flushTimer);
      window.removeEventListener("beforeunload", flushDwell);
      flushDwell();
    };
  }, [teamId, flushDwell]);

  useEffect(() => {
    fetch(`/api/documents/${documentId}/highlights`)
      .then((r) => r.json())
      .then((data) => setHighlights(data.highlights ?? []))
      .catch(() => setHighlights([]));
    fetch(`/api/documents/${documentId}/reactions`)
      .then((r) => r.json())
      .then((data) => setReactions(data.reactions ?? []))
      .catch(() => setReactions([]));
  }, [documentId]);

  const handleChannel = useCallback(
    (channel: Channel) => {
      channel.bind(
        "cursor-move",
        (data: { documentId: string; page: number; x: number; y: number; authorId: string; authorName: string }) => {
          if (data.documentId !== documentId || data.authorId === session?.user?.id) return;
          setRemoteCursors((prev) => ({
            ...prev,
            [data.authorId]: { authorId: data.authorId, authorName: data.authorName, page: data.page, x: data.x, y: data.y },
          }));
          // Drop a cursor if its author goes quiet for a few seconds.
          if (cursorTimeouts.current[data.authorId]) clearTimeout(cursorTimeouts.current[data.authorId]);
          cursorTimeouts.current[data.authorId] = setTimeout(() => {
            setRemoteCursors((prev) => {
              const next = { ...prev };
              delete next[data.authorId];
              return next;
            });
          }, 4000);
        }
      );
      channel.bind(
        "highlight-added",
        (data: { documentId: string; highlight: HighlightItem }) => {
          if (data.documentId !== documentId || data.highlight.authorId === session?.user?.id) return;
          setHighlights((prev) =>
            prev.some((h) => h.id === data.highlight.id) ? prev : [...prev, { ...data.highlight, isMine: false }]
          );
        }
      );
      channel.bind("member-kicked", (data: { kickedUserId: string }) => {
        if (data.kickedUserId !== session?.user?.id) return;
        toast.show("You were removed from this room by the host.", "error");
        router.push("/dashboard");
      });
      channel.bind("room-disbanded", () => {
        toast.show("This room has been closed by the host.", "error");
        router.push("/dashboard");
      });
    },
    [documentId, session?.user?.id, router, toast]
  );

  useTeamChannel(teamId, handleChannel);

  const broadcastCursor = useMemo(
    () =>
      throttle((page: number, x: number, y: number) => {
        if (!teamId) return;
        fetch(`/api/documents/${documentId}/cursor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page, x, y }),
        }).catch(() => {});
      }, 150),
    [documentId, teamId]
  );

  const handlePageMouseMove = (e: React.MouseEvent) => {
    if (!teamId || !pageWrapperRef.current) return;
    const rect = pageWrapperRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    broadcastCursor(currentPage, x, y);
  };

  const currentPageCursors = Object.values(remoteCursors).filter((c) => c.page === currentPage);

  const toggleReaction = async (targetId: string, emoji: string) => {
    setReactions((prev) => {
      const mine = prev.find(
        (r) => r.targetType === "HIGHLIGHT" && r.targetId === targetId && r.emoji === emoji && r.isMine
      );
      if (mine) return prev.filter((r) => r !== mine);
      return [
        ...prev,
        { targetType: "HIGHLIGHT" as const, targetId, emoji, authorId: "me", authorName: "You", isMine: true },
      ];
    });
    await fetch("/api/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "HIGHLIGHT", targetId, emoji }),
    }).catch(() => {});
  };

  const pageHighlights = useMemo(
    () => highlights.filter((h) => h.page === currentPage),
    [highlights, currentPage]
  );

  // react-pdf tears down and rebuilds the text layer's DOM whenever this
  // function's reference changes (it's an effect dependency internally) —
  // which collapses any in-progress native text selection. An inline arrow
  // function here would change on every render (including unrelated ones,
  // like a remote cursor broadcast arriving), so it must be memoized against
  // only the state it actually reads.
  const highlightPattern = useCallback(
    (text: string) => {
      let result = text;
      // Author highlights first (colored marks), then the search term on top.
      for (const h of pageHighlights) {
        const escaped = escapeRegExp(h.textSnippet);
        if (!escaped) continue;
        result = result.replace(
          new RegExp(`(${escaped})`, "gi"),
          `<mark style="background-color:${h.color}66;color:inherit;border-radius:2px">$1</mark>`
        );
      }
      if (searchText.trim()) {
        const escaped = escapeRegExp(searchText);
        result = result.replace(new RegExp(`(${escaped})`, "gi"), "<mark>$1</mark>");
      }
      return result;
    },
    [pageHighlights, searchText]
  );

  const customTextRenderer = useCallback(
    ({ str }: { str: string }) => highlightPattern(str),
    [highlightPattern]
  );

  const handleMouseUp = () => {
    if (!canEdit) return;
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    const container = containerRef.current;
    const pageWrapper = pageWrapperRef.current;
    if (!text || !sel || sel.rangeCount === 0 || !container || !pageWrapper) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const pageRect = pageWrapper.getBoundingClientRect();
    setSelection({
      text,
      x: rect.left - containerRect.left + container.scrollLeft + rect.width / 2,
      y: rect.top - containerRect.top + container.scrollTop,
      // Position within the page itself (0-1), for anchoring a linked sticky
      // note in the margin beside this passage.
      pageX: Math.min(1, Math.max(0, (rect.right - pageRect.left) / pageRect.width)),
      pageY: Math.min(1, Math.max(0, (rect.top - pageRect.top) / pageRect.height)),
    });
  };

  const createHighlight = async () => {
    if (!selection) return;
    const { text } = selection;
    setSelection(null);
    window.getSelection()?.removeAllRanges();

    const res = await fetch(`/api/documents/${documentId}/highlights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        textSnippet: text,
        page: currentPage,
        startOffset: 0,
        endOffset: text.length,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.highlight) {
      setHighlights((prev) => [
        ...prev,
        {
          id: data.highlight.id,
          page: data.highlight.page,
          textSnippet: data.highlight.textSnippet,
          color: data.highlight.color,
          authorId: data.highlight.authorId,
          authorName: "You",
          isMine: true,
        },
      ]);
    }
  };

  const deleteHighlight = async (id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    await fetch(`/api/highlights/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const addSelectionToNotes = () => {
    if (!selection || !onAddToNotes) return;
    onAddToNotes(selection.text, currentPage);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const addSelectionAsStickyNote = () => {
    if (!selection) return;
    // Anchor just to the right of the passage, in the margin, per spec —
    // and mark the passage itself so the connection is visually obvious.
    stickyNoteLayerRef.current?.createAt(Math.min(0.92, selection.pageX + 0.02), selection.pageY);
    createHighlight();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="glass mb-3 flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2">
        <div className="flex items-center gap-0.5">
          <IconButton
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            label="Previous page"
          >
            <ChevronLeft size={16} />
          </IconButton>
          <span className="min-w-[5.5rem] text-center text-sm tabular-nums">
            {currentPage} / {numPages || "…"}
          </span>
          <IconButton
            onClick={() => setCurrentPage((p) => Math.min(numPages || p, p + 1))}
            disabled={currentPage >= numPages}
            label="Next page"
          >
            <ChevronRight size={16} />
          </IconButton>
        </div>

        <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />

        <div className="flex items-center gap-0.5">
          <IconButton onClick={() => setScale((s) => Math.max(0.5, s - 0.1))} label="Zoom out">
            <ZoomOut size={16} />
          </IconButton>
          <span className="w-11 text-center text-sm tabular-nums">{Math.round(scale * 100)}%</span>
          <IconButton onClick={() => setScale((s) => Math.min(3, s + 0.1))} label="Zoom in">
            <ZoomIn size={16} />
          </IconButton>
        </div>

        <div className="relative min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search in page…"
            className="w-full rounded-lg border border-black/10 bg-transparent py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-accent dark:border-white/10"
          />
        </div>

        <IconButton
          onClick={() => setShowThumbnails((v) => !v)}
          label={showThumbnails ? "Hide thumbnails" : "Show thumbnails"}
        >
          <PanelLeft size={16} />
        </IconButton>

        {canEdit && (
          <>
            <Tooltip label={drawMode ? "Stop drawing" : "Draw on page"}>
              <button
                onClick={() => {
                  setDrawMode((v) => !v);
                  setStickyMode(false);
                }}
                aria-label={drawMode ? "Stop drawing" : "Draw on page"}
                className={`flex h-11 w-11 items-center justify-center rounded-lg transition ${
                  drawMode ? "bg-accent text-accent-foreground" : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                <Pencil size={16} />
              </button>
            </Tooltip>

            <Tooltip label={stickyMode ? "Cancel sticky note" : "Place a sticky note"}>
              <button
                onClick={() => {
                  setStickyMode((v) => !v);
                  setDrawMode(false);
                }}
                aria-label={stickyMode ? "Cancel sticky note" : "Place a sticky note"}
                className={`flex h-11 w-11 items-center justify-center rounded-lg transition ${
                  stickyMode ? "bg-accent text-accent-foreground" : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                <StickyNote size={16} />
              </button>
            </Tooltip>
          </>
        )}

        {onToggleFullscreen && (
          <IconButton
            onClick={onToggleFullscreen}
            label={fullscreen ? "Exit full screen" : "Full screen"}
          >
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </IconButton>
        )}
      </div>

      <div className="flex min-w-0 flex-1 gap-3 overflow-hidden">
        {showThumbnails && (
          <div className="glass w-28 shrink-0 overflow-y-auto rounded-2xl p-2">
            <Document file={fileUrl} loading={null}>
              {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setCurrentPage(n)}
                  className={`mb-2 block w-full rounded-lg border-2 transition ${
                    n === currentPage ? "border-accent" : "border-transparent"
                  }`}
                >
                  <Thumbnail pageNumber={n} width={90} />
                </button>
              ))}
            </Document>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden">
          <div
            ref={containerRef}
            className="glass relative flex flex-1 flex-col items-center overflow-auto rounded-2xl p-4"
            onMouseUp={handleMouseUp}
            onMouseMove={handlePageMouseMove}
          >
            {selection && (
              <div
                className="glass absolute z-10 flex -translate-x-1/2 -translate-y-full gap-1 rounded-xl p-1 shadow-lg"
                style={{ left: selection.x, top: selection.y - 8 }}
              >
                <button
                  onClick={createHighlight}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Highlighter size={13} /> Highlight
                </button>
                {onAddToNotes && (
                  <button
                    onClick={addSelectionToNotes}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <StickyNote size={13} /> Add to notes
                  </button>
                )}
                <button
                  onClick={addSelectionAsStickyNote}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <StickyNote size={13} /> Sticky note
                </button>
              </div>
            )}

            {!loaded && (
              <div className="flex flex-col items-center gap-3 p-8">
                <Skeleton className="h-[70vh] w-full max-w-md" />
              </div>
            )}
            <div className={loaded ? "animate-fade-in" : "hidden"}>
              <Document
                file={fileUrl}
                onLoadSuccess={({ numPages: n }) => {
                  setNumPages(n);
                  setLoaded(true);
                }}
                error={<p className="p-8 text-center text-sm text-red-500">Failed to load PDF.</p>}
              >
                <div ref={pageWrapperRef} className="relative inline-block">
                  <Page
                    key={currentPage}
                    pageNumber={currentPage}
                    scale={scale}
                    className="animate-fade-in"
                    customTextRenderer={customTextRenderer}
                    renderAnnotationLayer
                    renderTextLayer
                    onRenderSuccess={(page) =>
                      setPageDimensions({ width: page.width, height: page.height })
                    }
                  />
                  {pageDimensions.width > 0 && (
                    <>
                      <DrawingCanvas
                        documentId={documentId}
                        page={currentPage}
                        width={pageDimensions.width}
                        height={pageDimensions.height}
                        active={drawMode}
                        teamId={teamId}
                        onPinchZoom={(factor) =>
                          setScale((s) => Math.min(3, Math.max(0.5, s * factor)))
                        }
                        onPan={(dx, dy) => {
                          const el = containerRef.current;
                          if (el) {
                            el.scrollLeft -= dx;
                            el.scrollTop -= dy;
                          }
                        }}
                      />
                      <StickyNoteLayer
                        ref={stickyNoteLayerRef}
                        documentId={documentId}
                        page={currentPage}
                        width={pageDimensions.width}
                        height={pageDimensions.height}
                        shared={shared}
                        placing={stickyMode}
                        onPlaced={() => setStickyMode(false)}
                      />
                      {currentPageCursors.map((c) => (
                        <div
                          key={c.authorId}
                          className="pointer-events-none absolute z-20 flex flex-col items-start transition-[left,top] duration-100"
                          style={{ left: c.x * pageDimensions.width, top: c.y * pageDimensions.height }}
                        >
                          <div
                            className="h-3 w-3 rounded-full border-2 border-white shadow"
                            style={{ backgroundColor: colorForAuthor(c.authorId) }}
                          />
                          <span
                            className="mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] text-white shadow"
                            style={{ backgroundColor: colorForAuthor(c.authorId) }}
                          >
                            {c.authorName}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </Document>
            </div>
          </div>

          {pageHighlights.length > 0 && (
            <div className="glass flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-2xl p-2">
              {pageHighlights.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                  style={{ backgroundColor: `${h.color}22`, color: h.color }}
                >
                  <span className="max-w-[10rem] truncate">{h.textSnippet}</span>
                  <span className="opacity-70">— {h.authorName}</span>
                  {h.isMine && (
                    <button
                      onClick={() => deleteHighlight(h.id)}
                      aria-label="Remove highlight"
                      className="opacity-60 hover:opacity-100"
                    >
                      <X size={11} />
                    </button>
                  )}
                  <ReactionBar
                    reactions={reactions.filter((r) => r.targetType === "HIGHLIGHT" && r.targetId === h.id)}
                    onToggle={(emoji) => toggleReaction(h.id, emoji)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
