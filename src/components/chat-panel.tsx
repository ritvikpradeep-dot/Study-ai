"use client";

import { useEffect, useRef, useState } from "react";

type Message = { id: string; role: "user" | "assistant"; content: string };

export function ChatPanel({ documentId }: { documentId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/documents/${documentId}/chat`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => {});
  }, [documentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    setError(null);

    const userMsg: Message = { id: `local-${Date.now()}`, role: "user", content: question };
    const assistantId = `local-${Date.now()}-a`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setLoading(true);

    const res = await fetch(`/api/documents/${documentId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question }),
    });

    if (!res.ok || !res.body) {
      setError(await res.text());
      setLoading(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
      );
    }
    setLoading(false);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex-1 overflow-y-auto rounded-2xl glass p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-center text-sm opacity-50">
            Ask anything about this document — follow-ups remember context.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
              m.role === "user"
                ? "self-end bg-indigo-600 text-white"
                : "self-start bg-black/5 dark:bg-white/10"
            }`}
          >
            {m.content || (loading && m.role === "assistant" ? "…" : "")}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="whitespace-pre-wrap text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask a question about this document…"
          className="flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-transparent px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={send}
          disabled={loading}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </div>
  );
}
