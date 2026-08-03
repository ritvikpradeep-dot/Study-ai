"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Channel } from "pusher-js";
import { Eye, MessagesSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useTeamChannel } from "@/hooks/use-team-channel";
import { ActivityFeed } from "@/components/activity-feed";

type LiveViewer = { authorId: string; authorName: string; page: number; lastSeen: number };
type ChatMessage = { id: string; content: string; authorName: string; createdAt: string };

const STALE_MS = 4000;
const CHAT_POLL_MS = 5000;

// Admin-only, read-only room observer: subscribes to the room's realtime
// channel like a normal client would, but never broadcasts anything of its
// own (no cursor, no stroke preview, no chat message, no TeamMember row) —
// so nothing here is visible to the room's actual members.
export function AdminRoomLiveView({ teamId }: { teamId: string }) {
  const [viewers, setViewers] = useState<Record<string, LiveViewer>>({});
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const staleTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleChannel = useCallback((channel: Channel) => {
    channel.bind(
      "cursor-move",
      (data: { page: number; authorId: string; authorName: string }) => {
        setViewers((prev) => ({
          ...prev,
          [data.authorId]: { authorId: data.authorId, authorName: data.authorName, page: data.page, lastSeen: Date.now() },
        }));
      }
    );
  }, []);

  useTeamChannel(teamId, handleChannel);

  // Drop viewers who've gone quiet — cursor-move stops firing the moment
  // someone stops moving their mouse, so absence of events is the only
  // signal that they've left/gone idle.
  useEffect(() => {
    staleTimer.current = setInterval(() => {
      setViewers((prev) => {
        const next: Record<string, LiveViewer> = {};
        for (const [id, v] of Object.entries(prev)) {
          if (Date.now() - v.lastSeen < STALE_MS) next[id] = v;
        }
        return next;
      });
    }, 1000);
    return () => {
      if (staleTimer.current) clearInterval(staleTimer.current);
    };
  }, []);

  const loadChat = useCallback(() => {
    fetch(`/api/teams/${teamId}/chat`)
      .then((r) => r.json())
      .then((data) => setChat(data.messages ?? []))
      .catch(() => {});
  }, [teamId]);

  useEffect(() => {
    loadChat();
    const poll = setInterval(loadChat, CHAT_POLL_MS);
    return () => clearInterval(poll);
  }, [loadChat]);

  const activeViewers = Object.values(viewers);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-1.5 font-medium">
          <Eye size={16} className="text-accent" /> Live viewers ({activeViewers.length})
        </h2>
        {activeViewers.length === 0 ? (
          <p className="text-sm opacity-50">No one is actively viewing a document right now.</p>
        ) : (
          <div className="flex flex-col gap-1.5 text-sm">
            {activeViewers.map((v) => (
              <div key={v.authorId} className="flex items-center justify-between rounded-xl bg-black/5 px-3 py-2 dark:bg-white/5">
                <span>{v.authorName}</span>
                <span className="text-xs opacity-60">page {v.page}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs opacity-50">
          Updates live from cursor movement — disappears ~4s after someone stops moving their mouse.
        </p>
      </Card>

      <ActivityFeed teamId={teamId} />

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-1.5 font-medium">
          <MessagesSquare size={16} className="text-accent" /> Room chat ({chat.length})
        </h2>
        {chat.length === 0 ? (
          <p className="text-sm opacity-50">No messages yet.</p>
        ) : (
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {chat.map((m) => (
              <div key={m.id} className="rounded-xl bg-black/5 px-3 py-2 text-sm dark:bg-white/5">
                <p className="mb-0.5 text-xs opacity-50">
                  {m.authorName} · {new Date(m.createdAt).toLocaleTimeString()}
                </p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
