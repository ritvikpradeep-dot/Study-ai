"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, RotateCcw, Square, Check } from "lucide-react";
import { MarkdownMessage } from "@/components/markdown-message";
import { useToast } from "@/components/ui/toast";

type Message = { id: string; role: "user" | "assistant"; content: string };

export function ChatPanel({ documentId }: { documentId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { show } = useToast();

  useEffect(() => {
    fetch(`/api/documents/${documentId}/chat`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => {});
  }, [documentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const streamInto = async (assistantId: string, body: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/documents/${documentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
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
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)));
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");

    const userMsg: Message = { id: `local-${Date.now()}`, role: "user", content: question };
    const assistantId = `local-${Date.now()}-a`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    await streamInto(assistantId, { message: question });
  };

  const regenerate = async () => {
    if (loading || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;
    const assistantId = last.id;
    setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: "" } : m)));
    await streamInto(assistantId, { regenerate: true });
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const copy = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    show("Copied to clipboard", "success");
    setTimeout(() => setCopiedId(null), 1500);
  };

  const lastAssistantId =
    [...messages].reverse().find((m) => m.role === "assistant")?.id ?? null;

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
            className={`group relative max-w-[90%] rounded-2xl px-4 py-2 text-sm animate-fade-in ${
              m.role === "user"
                ? "self-end bg-accent text-accent-foreground"
                : "self-start bg-black/5 dark:bg-white/10"
            }`}
          >
            {m.role === "assistant" ? (
              m.content ? (
                <MarkdownMessage content={m.content} />
              ) : (
                loading && <span className="opacity-50">…</span>
              )
            ) : (
              <span className="whitespace-pre-wrap">{m.content}</span>
            )}

            {m.role === "assistant" && m.content && !loading && (
              <div className="mt-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => copy(m.id, m.content)}
                  className="rounded-md p-1 hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label="Copy response"
                >
                  {copiedId === m.id ? <Check size={13} /> : <Copy size={13} />}
                </button>
                {m.id === lastAssistantId && (
                  <button
                    onClick={regenerate}
                    className="rounded-md p-1 hover:bg-black/10 dark:hover:bg-white/10"
                    aria-label="Regenerate response"
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
              </div>
            )}
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
          className="flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-transparent px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
        />
        {loading ? (
          <button
            onClick={stop}
            className="flex items-center gap-1.5 rounded-xl bg-black/5 px-4 py-2.5 text-sm font-medium transition hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
          >
            <Square size={13} /> Stop
          </button>
        ) : (
          <button
            onClick={send}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
