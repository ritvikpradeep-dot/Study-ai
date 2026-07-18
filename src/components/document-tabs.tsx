"use client";

import { forwardRef, useState } from "react";
import { SummarizerPanel } from "@/components/summarizer-panel";
import { ChatPanel } from "@/components/chat-panel";
import { QuizPanel } from "@/components/quiz-panel";
import { NotesPanel, type NotesPanelHandle } from "@/components/notes-panel";

const TABS = [
  { value: "chat", label: "Chat" },
  { value: "summarize", label: "Summarize" },
  { value: "quiz", label: "Quiz" },
  { value: "notes", label: "Notes" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export const DocumentTabs = forwardRef<
  NotesPanelHandle,
  {
    documentId: string;
    title: string;
    teamId: string | null;
    isHost: boolean;
    initialSharedSummary: string | null;
    initialSummaryGeneratedAt: string | null;
  }
>(function DocumentTabs(
  { documentId, title, teamId, isHost, initialSharedSummary, initialSummaryGeneratedAt },
  notesRef
) {
    const [tab, setTab] = useState<Tab>("chat");

    return (
      <div className="glass flex h-full flex-col rounded-2xl p-3">
        <p className="mb-2 truncate px-1 text-sm font-medium opacity-80">{title}</p>
        <div className="mb-3 flex gap-1 rounded-xl bg-black/5 dark:bg-white/10 p-1">
          {TABS.map((t) => (
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
            <NotesPanel ref={notesRef} documentId={documentId} shared={Boolean(teamId)} />
          </div>
        </div>
      </div>
    );
  }
);
