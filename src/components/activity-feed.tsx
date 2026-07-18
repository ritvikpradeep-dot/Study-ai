"use client";

import { useEffect, useState } from "react";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";

type Entry = { id: string; message: string; createdAt: string };

const POLL_INTERVAL_MS = 10_000;

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ActivityFeed({ teamId }: { teamId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const load = () => {
      fetch(`/api/teams/${teamId}/activity`)
        .then((r) => r.json())
        .then((data) => setEntries(data.entries ?? []))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [teamId]);

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
          {entries.length === 0 ? (
            <p className="text-center text-sm opacity-50">No activity yet.</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-2 text-xs">
                <span className="opacity-80">{e.message}</span>
                <span className="shrink-0 opacity-50">{relativeTime(e.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
