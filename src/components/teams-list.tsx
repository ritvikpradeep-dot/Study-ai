"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UsersRound, Plus, LogIn, FileText, Compass } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type Team = {
  id: string;
  name: string;
  myRole: "OWNER" | "MEMBER";
  memberCount: number;
  maxMembers: number;
  documentCount: number;
};

type PublicRoom = {
  id: string;
  name: string;
  hostName: string;
  memberCount: number;
  maxMembers: number;
  isFull: boolean;
};

export function TeamsList({ initialTeams }: { initialTeams: Team[] }) {
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState<"mine" | "discover">("mine");
  const [teams] = useState(initialTeams);
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinTargetName, setJoinTargetName] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (view !== "discover" || rooms !== null) return;
    fetch("/api/teams/discover")
      .then((r) => r.json())
      .then((data) => setRooms(data.rooms ?? []))
      .catch(() => setRooms([]));
  }, [view, rooms]);

  async function createTeam() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.show(json.error || "Failed to create team.", "error");
        return;
      }
      setCreateOpen(false);
      setName("");
      router.push(`/teams/${json.team.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function joinTeam() {
    if (!inviteCode.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/teams/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: inviteCode.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.show(json.error || "Failed to join team.", "error");
        return;
      }
      setJoinOpen(false);
      setInviteCode("");
      router.push(`/teams/${json.team.id}`);
    } finally {
      setBusy(false);
    }
  }

  function openJoin(roomName?: string) {
    setJoinTargetName(roomName ?? null);
    setJoinOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rooms</h1>
          <p className="mt-1 text-sm opacity-70">
            Share documents, notes, and quizzes with a group instead of studying alone.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => openJoin()}>
            <LogIn size={15} /> Join with code
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> New room
          </Button>
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-xl bg-black/5 dark:bg-white/10 p-1">
        <button
          onClick={() => setView("mine")}
          className={`rounded-lg px-3.5 py-1.5 text-sm transition ${
            view === "mine" ? "bg-white dark:bg-black shadow" : "opacity-60"
          }`}
        >
          My rooms
        </button>
        <button
          onClick={() => setView("discover")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm transition ${
            view === "discover" ? "bg-white dark:bg-black shadow" : "opacity-60"
          }`}
        >
          <Compass size={14} /> Discover
        </button>
      </div>

      {view === "mine" ? (
        teams.length === 0 ? (
          <EmptyState
            title="No rooms yet"
            description="Create a room to share documents with classmates, or browse Discover to join an existing one."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((team) => (
              <Card key={team.id} hover className="p-4">
                <a href={`/teams/${team.id}`} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-medium">
                      <UsersRound size={15} className="text-accent" />
                      {team.name}
                    </p>
                    <p className="mt-1 flex items-center gap-3 text-xs opacity-60">
                      <span>
                        {team.memberCount}/{team.maxMembers} members
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText size={12} /> {team.documentCount}
                      </span>
                    </p>
                  </div>
                  <Badge tone={team.myRole === "OWNER" ? "accent" : "neutral"}>
                    {team.myRole === "OWNER" ? "Host" : "Member"}
                  </Badge>
                </a>
              </Card>
            ))}
          </div>
        )
      ) : rooms === null ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : rooms.length === 0 ? (
        <EmptyState title="No public rooms yet" description="Be the first to create one." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rooms.map((room) => (
            <Card key={room.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    <UsersRound size={15} className="text-accent" />
                    {room.name}
                  </p>
                  <p className="mt-1 text-xs opacity-60">Hosted by {room.hostName}</p>
                  <p className="mt-0.5 text-xs opacity-60">
                    {room.memberCount}/{room.maxMembers} members
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={room.isFull}
                  onClick={() => openJoin(room.name)}
                >
                  {room.isFull ? "Full" : "Join"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a room">
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createTeam()}
            placeholder="e.g. CS 301 Study Group"
            maxLength={60}
            className="rounded-xl border border-black/10 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-accent dark:border-white/15"
          />
          <Button onClick={createTeam} disabled={busy || !name.trim()}>
            Create room
          </Button>
        </div>
      </Modal>

      <Modal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title={joinTargetName ? `Join "${joinTargetName}"` : "Join a room"}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm opacity-70">Ask the host for their room&apos;s invite code.</p>
          <input
            autoFocus
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinTeam()}
            placeholder="Invite code"
            className="rounded-xl border border-black/10 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-accent dark:border-white/15"
          />
          <Button onClick={joinTeam} disabled={busy || !inviteCode.trim()}>
            Join room
          </Button>
        </div>
      </Modal>
    </div>
  );
}
