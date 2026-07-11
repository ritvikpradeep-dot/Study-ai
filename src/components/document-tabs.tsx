"use client";

import { useState } from "react";
import { SummarizerPanel } from "@/components/summarizer-panel";
import { ChatPanel } from "@/components/chat-panel";
import { QuizPanel } from "@/components/quiz-panel";

const TABS = [
  { value: "chat", label: "Chat" },
  { value: "summarize", label: "Summarize" },
  { value: "quiz", label: "Quiz" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export function DocumentTabs({ documentId, title }: { documentId: string; title: string }) {
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
        {tab === "summarize" && <SummarizerPanel documentId={documentId} />}
        {tab === "quiz" && <QuizPanel documentId={documentId} />}
      </div>
    </div>
  );
}
