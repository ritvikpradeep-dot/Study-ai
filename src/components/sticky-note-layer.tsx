"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { X } from "lucide-react";
import { colorForAuthor } from "@/lib/annotation-colors";

type StickyNoteItem = {
  id: string;
  page: number;
  x: number;
  y: number;
  content: string;
  color: string;
  authorId: string;
  authorName: string;
  isMine: boolean;
};

const NOTE_WIDTH = 168;

// Deterministic small tilt per note so notes look "hand-placed" without
// storing a rotation value — purely a render-time flourish, not data.
function rotationForId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 7) - 3; // -3..3 degrees
}

export type StickyNoteLayerHandle = {
  createAt: (x: number, y: number) => void;
};

export const StickyNoteLayer = forwardRef<
  StickyNoteLayerHandle,
  {
    documentId: string;
    page: number;
    width: number;
    height: number;
    shared: boolean;
    placing: boolean;
    onPlaced?: () => void;
  }
>(function StickyNoteLayer({ documentId, page, width, height, shared, placing, onPlaced }, ref) {
  const [notes, setNotes] = useState<StickyNoteItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const dragState = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/documents/${documentId}/sticky-notes`)
      .then((r) => r.json())
      .then((data) => setNotes(data.stickyNotes ?? []))
      .catch(() => setNotes([]));
  }, [documentId]);

  const pageNotes = notes.filter((n) => n.page === page);

  const create = useCallback(
    async (x: number, y: number) => {
      const res = await fetch(`/api/documents/${documentId}/sticky-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, x, y, content: "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.stickyNote) {
        setNotes((prev) => [
          ...prev,
          {
            id: data.stickyNote.id,
            page: data.stickyNote.page,
            x: data.stickyNote.x,
            y: data.stickyNote.y,
            content: "",
            color: data.stickyNote.color,
            authorId: data.stickyNote.authorId,
            authorName: "You",
            isMine: true,
          },
        ]);
        setEditingId(data.stickyNote.id);
      }
      onPlaced?.();
    },
    [documentId, page, onPlaced]
  );

  useImperativeHandle(ref, () => ({
    createAt: (x: number, y: number) => {
      create(x, y);
    },
  }));

  const updateContent = async (id: string, content: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)));
    await fetch(`/api/sticky-notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }).catch(() => {});
  };

  const move = async (id: string, x: number, y: number) => {
    await fetch(`/api/sticky-notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x, y }),
    }).catch(() => {});
  };

  const remove = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/sticky-notes/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!placing) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    create(x, y);
  };

  const onNoteDragStart = (e: React.PointerEvent, note: StickyNoteItem) => {
    if (!note.isMine) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { id: note.id, startX: note.x, startY: note.y };
  };

  const onNoteDragMove = (e: React.PointerEvent, note: StickyNoteItem) => {
    if (!dragState.current || dragState.current.id !== note.id) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, x, y } : n)));
  };

  const onNoteDragEnd = (note: StickyNoteItem) => {
    if (!dragState.current || dragState.current.id !== note.id) return;
    dragState.current = null;
    const current = notes.find((n) => n.id === note.id);
    if (current) move(note.id, current.x, current.y);
  };

  return (
    <div
      ref={containerRef}
      className="absolute left-0 top-0"
      style={{ width, height, pointerEvents: placing ? "auto" : "none", cursor: placing ? "copy" : "default" }}
      onClick={onOverlayClick}
    >
      {pageNotes.map((note) => {
        const rotation = rotationForId(note.id);
        const editing = editingId === note.id;
        return (
          <div
            key={note.id}
            onPointerDown={(e) => onNoteDragStart(e, note)}
            onPointerMove={(e) => onNoteDragMove(e, note)}
            onPointerUp={() => onNoteDragEnd(note)}
            className="absolute rounded-sm p-2 text-xs shadow-md"
            style={{
              left: note.x * width,
              top: note.y * height,
              width: NOTE_WIDTH,
              backgroundColor: "#FAEEDA",
              color: "#7a5230",
              transform: `rotate(${rotation}deg)`,
              pointerEvents: "auto",
              cursor: note.isMine ? "grab" : "default",
              zIndex: editing ? 20 : 10,
            }}
          >
            {note.isMine && (
              <button
                onClick={() => remove(note.id)}
                aria-label="Remove sticky note"
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40"
              >
                <X size={9} />
              </button>
            )}
            {shared && (
              <div className="mb-1 flex items-center gap-1">
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-medium text-white"
                  style={{ backgroundColor: note.color || colorForAuthor(note.authorId) }}
                >
                  {note.authorName?.[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="truncate text-[10px] opacity-60">{note.authorName?.split(" ")[0]}</span>
              </div>
            )}
            {editing && note.isMine ? (
              <textarea
                autoFocus
                value={note.content}
                onChange={(e) => updateContent(note.id, e.target.value)}
                onBlur={() => setEditingId(null)}
                className="w-full resize-none bg-transparent text-xs leading-snug outline-none"
                rows={4}
                placeholder="Type a note…"
              />
            ) : (
              <p
                onClick={() => note.isMine && setEditingId(note.id)}
                className="min-h-[3rem] whitespace-pre-wrap break-words leading-snug"
              >
                {note.content || (note.isMine ? "Click to write…" : "")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
});
