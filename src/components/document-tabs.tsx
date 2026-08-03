"use client";

import { forwardRef, useState } from "react";
import { SummarizerPanel } from "@/components/summarizer-panel";
import { ChatPanel } from "@/components/chat-panel";
import { QuizPanel } from "@/components/quiz-panel";
import { NotesPanel, type NotesPanelHandle } from "@/components/notes-panel";
import { RoomChat } from "@/components/room-chat";

// "roomChat" is human-to-human chat between people currently in the room —
// entirely separate from "chat", which is the AI Q&A panel. Only shown for
// room documents; a solo document has no one else to chat with.
const ALL_TABS = [
  { value: "chat", label: "Chat" },
  { value: "summarize", label: "Summarize" },
  { value: "quiz", label: "Quiz" },
  { value: "notes", label: "Notes" },
  { value: "roomChat", label: "Room Chat" },
] as const;

type Tab = (typeof ALL_TABS)[number]["value"];

export const DocumentTabs = forwardRef<
  NotesPanelHandle,
  {
    documentId: string;
    title: string;
    teamId: string | null;
    isHost: boolean;
    canEdit: boolean;
    initialSharedSummary: string | null;
    initialSummaryGeneratedAt: string | null;
  }
>(function DocumentTabs(
  { documentId, title, teamId, isHost, canEdit, initialSharedSummary, initialSummaryGeneratedAt },
  notesRef
) {
    const [tab, setTab] = useState<Tab>("chat");
    const tabs = teamId ? ALL_TABS : ALL_TABS.filter((t) => t.value !== "roomChat");

    return (
      <div className="glass flex h-full flex-col rounded-2xl p-3">
        <p className="mb-2 truncate px-1 text-sm font-medium opacity-80">{title}</p>
        <div className="mb-3 flex gap-1 rounded-xl bg-black/5 dark:bg-white/10 p-1">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex-1 rounded-lg py-1.5 text-sm transition ${
                tab === t.value ? "bg-white dark:bg-black shadow" : "opacity-60"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden">
          {tab === "chat" && <ChatPanel documentId={documentId} />}
          {tab === "summarize" && (
            <SummarizerPanel
              documentId={documentId}
              teamId={teamId}
              isHost={isHost}
              initialSharedSummary={initialSharedSummary}
              initialSummaryGeneratedAt={initialSummaryGeneratedAt}
            />
          )}
          {tab === "quiz" && <QuizPanel documentId={documentId} />}
          {/* Kept mounted (just hidden) rather than unmounted on tab switch so a
              highlight captured while on another tab still has a live NotesPanel
              instance to append into via the ref. */}
          <div className={tab === "notes" ? "h-full" : "hidden"}>
            <NotesPanel ref={notesRef} documentId={documentId} shared={Boolean(teamId)} canEdit={canEdit} />
          </div>
          {/* Also kept mounted while hidden — unmounting would drop the polled
              message list and in-progress input text every time the user tabs
              away and back. Fully separate from the AI "chat" tab above. */}
          {teamId && (
            <div className={tab === "roomChat" ? "h-full" : "hidden"}>
              <RoomChat teamId={teamId} className="h-full" />
            </div>
          )}
        </div>
      </div>
    );
  }
);
