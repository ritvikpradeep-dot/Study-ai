"use client";

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { colorForAuthor } from "@/lib/annotation-colors";
import { ReactionBar, type ReactionItem } from "@/components/reaction-bar";

type SaveState = "idle" | "saving" | "saved" | "error";
type OtherNote = {
  id: string;
  authorId: string;
  authorName: string | null;
  content: string;
  updatedAt: string | null;
};

export type NotesPanelHandle = {
  appendHighlight: (text: string, page?: number) => void;
};

export const NotesPanel = forwardRef<
  NotesPanelHandle,
  { documentId: string; shared: boolean; canEdit: boolean }
>(function NotesPanel({ documentId, shared, canEdit }, ref) {
    const [content, setContent] = useState("");
    const [otherNotes, setOtherNotes] = useState<OtherNote[]>([]);
    const [reactions, setReactions] = useState<ReactionItem[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const [generating, setGenerating] = useState(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestContent = useRef("");

    useEffect(() => {
      setLoaded(false);
      fetch(`/api/documents/${documentId}/notes`)
        .then((r) => r.json())
        .then((data) => {
          const notes: {
            id: string | null;
            authorId: string;
            authorName: string | null;
            content: string;
            updatedAt: string | null;
            isMine: boolean;
          }[] = data.notes ?? [];
          const mine = notes.find((n) => n.isMine);
          setContent(mine?.content ?? "");
          latestContent.current = mine?.content ?? "";
          setOtherNotes(
            notes
              .filter((n) => !n.isMine && n.id !== null)
              .map((n) => ({ ...n, id: n.id as string }))
          );
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    }, [documentId]);

    useEffect(() => {
      if (!shared) return;
      fetch(`/api/documents/${documentId}/reactions`)
        .then((r) => r.json())
        .then((data) => setReactions(data.reactions ?? []))
        .catch(() => setReactions([]));
    }, [documentId, shared]);

    const toggleReaction = async (targetId: string, emoji: string) => {
      setReactions((prev) => {
        const mine = prev.find(
          (r) => r.targetType === "NOTE" && r.targetId === targetId && r.emoji === emoji && r.isMine
        );
        if (mine) return prev.filter((r) => r !== mine);
        return [...prev, { targetType: "NOTE", targetId, emoji, authorId: "me", authorName: "You", isMine: true }];
      });
      await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "NOTE", targetId, emoji }),
      }).catch(() => {});
    };

    const save = useCallback(
      async (value: string) => {
        setSaveState("saving");
        try {
          const res = await fetch(`/api/documents/${documentId}/notes`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: value }),
          });
          setSaveState(res.ok ? "saved" : "error");
        } catch {
          setSaveState("error");
        }
      },
      [documentId]
    );

    const scheduleSave = useCallback(
      (value: string) => {
        latestContent.current = value;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => save(value), 800);
      },
      [save]
    );

    useEffect(() => {
      return () => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
      };
    }, []);

    useImperativeHandle(ref, () => ({
      appendHighlight(text: string, page?: number) {
        const prev = latestContent.current;
        const block = `${prev && !prev.endsWith("\n") ? "\n\n" : prev ? "\n" : ""}> Highlighted${
          page ? ` (page ${page})` : ""
        }: "${text.trim()}"\n`;
        const next = prev + block;
        setContent(next);
        scheduleSave(next);
      },
    }));

    const generateMySummary = async () => {
      setGenerating(true);
      try {
        const res = await fetch(`/api/documents/${documentId}/summarize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ length: "medium", style: "study-notes", options: [] }),
        });
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let generated = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          generated += decoder.decode(value, { stream: true });
        }

        const prev = latestContent.current;
        const block = `${prev && !prev.endsWith("\n") ? "\n\n" : prev ? "\n" : ""}My summary (AI-generated):\n${generated}\n`;
        const next = prev + block;
        setContent(next);
        scheduleSave(next);
      } finally {
        setGenerating(false);
      }
    };

    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto p-1">
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-medium uppercase tracking-wide opacity-60">
              Your notes{shared ? " (visible to room)" : ""}
            </p>
            <SaveIndicator state={saveState} />
          </div>
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setSaveState("idle");
              scheduleSave(e.target.value);
            }}
            disabled={!loaded || !canEdit}
            placeholder={
              canEdit
                ? "Type notes as you read — they save automatically. Select text in the PDF to add a highlighted excerpt here."
                : "You have view-only access to this document."
            }
            className="glass min-h-[160px] w-full resize-none rounded-2xl p-4 text-sm leading-relaxed outline-none placeholder:opacity-40 focus:ring-2 focus:ring-accent disabled:opacity-50"
          />
          {canEdit && (
            <button
              onClick={generateMySummary}
              disabled={generating}
              className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs opacity-70 transition hover:bg-black/5 hover:opacity-100 disabled:opacity-40 dark:hover:bg-white/10"
            >
              <Sparkles size={12} />
              {generating ? "Generating…" : "Generate my summary"}
            </button>
          )}
        </div>

        {shared && otherNotes.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="px-1 text-xs font-medium uppercase tracking-wide opacity-60">
              Other members&apos; notes
            </p>
            {otherNotes.map((note) => (
              <div key={note.id} className="glass rounded-2xl p-3 text-sm">
                <p
                  className="mb-1.5 text-xs font-medium"
                  style={{ color: colorForAuthor(note.authorId) }}
                >
                  {note.authorName}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed opacity-90">{note.content}</p>
                <div className="mt-2">
                  <ReactionBar
                    reactions={reactions.filter((r) => r.targetType === "NOTE" && r.targetId === note.id)}
                    onToggle={(emoji) => toggleReaction(note.id, emoji)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs opacity-50">
        <Loader2 size={12} className="animate-spin" /> Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <Check size={12} /> Saved
      </span>
    );
  }
  if (state === "error") {
    return <span className="text-xs text-red-500">Failed to save</span>;
  }
  return null;
}
