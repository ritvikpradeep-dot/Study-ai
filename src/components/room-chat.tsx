"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Channel } from "pusher-js";
import { Send, Trash2 } from "lucide-react";
import { colorForAuthor } from "@/lib/annotation-colors";
import { useTeamChannel } from "@/hooks/use-team-channel";

type Message = {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  isMine: boolean;
  createdAt: string;
};

const POLL_INTERVAL_MS = 4000;

export function RoomChat({ teamId, className = "h-[420px]" }: { teamId: string; className?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);

  const poll = useCallback(async () => {
    const url = new URL(`/api/teams/${teamId}/chat`, window.location.origin);
    if (lastIdRef.current) url.searchParams.set("after", lastIdRef.current);
    const res = await fetch(url.toString());
    if (!res.ok) return;
    const data = await res.json();
    const incoming: Message[] = data.messages ?? [];
    if (incoming.length === 0) return;
    lastIdRef.current = incoming[incoming.length - 1].id;
    setMessages((prev) => [...prev, ...incoming]);
  }, [teamId]);

  useEffect(() => {
    lastIdRef.current = null;
    setMessages([]);
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [teamId, poll]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const handleChannel = useCallback((channel: Channel) => {
    channel.bind("room-message-deleted", (data: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    });
  }, []);
  useTeamChannel(teamId, handleChannel);

  const deleteMessage = async (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/room-messages/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const send = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");
    try {
      const res = await fetch(`/api/teams/${teamId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.message) {
        lastIdRef.current = data.message.id;
        setMessages((prev) => [...prev, data.message]);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`glass flex flex-col rounded-2xl p-3 ${className}`}>
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide opacity-60">Room chat</p>
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-1">
        {messages.length === 0 ? (
          <p className="p-4 text-center text-sm opacity-50">No messages yet — say hi.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`group flex flex-col ${m.isMine ? "items-end" : "items-start"}`}>
              {!m.isMine && (
                <span className="mb-0.5 text-xs font-medium" style={{ color: colorForAuthor(m.authorId) }}>
                  {m.authorName}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                {m.isMine && (
                  <button
                    onClick={() => deleteMessage(m.id)}
                    aria-label="Delete message"
                    title="Delete message"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full opacity-40 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <div
                  className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${
                    m.isMine ? "bg-accent text-accent-foreground" : "bg-black/5 dark:bg-white/10"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message the room…"
          className="flex-1 rounded-xl border border-black/10 bg-transparent px-3.5 py-2 text-sm outline-none focus:border-accent dark:border-white/15"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
