"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UsersRound, Plus, LogIn, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

type Team = {
  id: string;
  name: string;
  myRole: "OWNER" | "MEMBER";
  memberCount: number;
  documentCount: number;
};

export function TeamsList({ initialTeams }: { initialTeams: Team[] }) {
  const router = useRouter();
  const toast = useToast();
  const [teams] = useState(initialTeams);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
          <p className="mt-1 text-sm opacity-70">
            Share documents, notes, and quizzes with a group instead of studying alone.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setJoinOpen(true)}>
            <LogIn size={15} /> Join
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> New team
          </Button>
        </div>
      </div>

      {teams.length === 0 ? (
        <EmptyState
          title="No teams yet"
          description="Create a team to share documents with classmates or colleagues, or join one with an invite code."
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
                      {team.memberCount} member{team.memberCount === 1 ? "" : "s"}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText size={12} /> {team.documentCount}
                    </span>
                  </p>
                </div>
                <Badge tone={team.myRole === "OWNER" ? "accent" : "neutral"}>
                  {team.myRole === "OWNER" ? "Owner" : "Member"}
                </Badge>
              </a>
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a team">
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
            Create team
          </Button>
        </div>
      </Modal>

      <Modal open={joinOpen} onClose={() => setJoinOpen(false)} title="Join a team">
        <div className="flex flex-col gap-3">
          <p className="text-sm opacity-70">Ask a team member for their invite code.</p>
          <input
            autoFocus
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinTeam()}
            placeholder="Invite code"
            className="rounded-xl border border-black/10 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-accent dark:border-white/15"
          />
          <Button onClick={joinTeam} disabled={busy || !inviteCode.trim()}>
            Join team
          </Button>
        </div>
      </Modal>
    </div>
  );
}
