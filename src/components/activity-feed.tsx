"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { Channel } from "pusher-js";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import { useTeamChannel } from "@/hooks/use-team-channel";
import { isGroupable, describeGroup } from "@/lib/activity-messages";

type ActivityAction =
  | "DOCUMENT_UPLOADED"
  | "NOTE_ADDED"
  | "HIGHLIGHT_ADDED"
  | "DRAWING_ADDED"
  | "STICKY_NOTE_ADDED"
  | "MEMBER_JOINED"
  | "MEMBER_LEFT"
  | "MEMBER_KICKED"
  | "EDIT_ACCESS_GRANTED"
  | "EDIT_ACCESS_REVOKED"
  | "POMODORO_STARTED"
  | "POMODORO_STOPPED"
  | "ROOM_CLOSED"
  | "INVITE_CODE_REGENERATED";

type Entry = { id: string; action: ActivityAction; actorId: string; actorName: string; message: string; createdAt: string };
type DisplayRow = { key: string; message: string; createdAt: string };

// Collapse consecutive same-actor, same-groupable-action entries within this
// window into one "X added N highlights" line. The underlying entries stay
// individually stored in the DB — this is display-only.
const GROUP_WINDOW_MS = 5 * 60_000;
// Live push (via Pusher) is the primary update path; this is just a safety
// net in case a message is missed or Pusher isn't configured.
const POLL_FALLBACK_MS = 30_000;

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function groupEntries(entries: Entry[]): DisplayRow[] {
  const rows: DisplayRow[] = [];
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i];
    if (!isGroupable(entry.action)) {
      rows.push({ key: entry.id, message: entry.message, createdAt: entry.createdAt });
      i++;
      continue;
    }
    let count = 1;
    let j = i + 1;
    while (
      j < entries.length &&
      entries[j].action === entry.action &&
      entries[j].actorId === entry.actorId &&
      new Date(entries[i].createdAt).getTime() - new Date(entries[j].createdAt).getTime() < GROUP_WINDOW_MS
    ) {
      count++;
      j++;
    }
    rows.push({
      key: entry.id,
      message: count === 1 ? entry.message : describeGroup(entry.action, entry.actorName, count),
      createdAt: entry.createdAt,
    });
    i = j;
  }
  return rows;
}

export function ActivityFeed({ teamId }: { teamId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/teams/${teamId}/activity`)
      .then((r) => r.json())
      .then((data) => setEntries(data.entries ?? []))
      .catch(() => {});
  }, [teamId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_FALLBACK_MS);
    return () => clearInterval(interval);
  }, [load]);

  const handleChannel = useCallback(
    (channel: Channel) => {
      channel.bind("activity-logged", load);
    },
    [load]
  );
  useTeamChannel(teamId, handleChannel);

  const rows = useMemo(() => groupEntries(entries), [entries]);

  return (
    <div className="glass rounded-2xl p-4">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <Activity size={16} className="text-accent" /> Activity
        </span>
        {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
      </button>

      {!collapsed && (
        <div className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="text-center text-sm opacity-50">No activity yet.</p>
          ) : (
            rows.map((r) => (
              <div key={r.key} className="flex items-start justify-between gap-2 text-xs">
                <span className="min-w-0 opacity-80">{r.message}</span>
                <span className="shrink-0 opacity-50">{relativeTime(r.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
