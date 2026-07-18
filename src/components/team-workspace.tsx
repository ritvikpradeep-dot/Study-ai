"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Channel } from "pusher-js";
import {
  Copy,
  Check,
  UsersRound,
  LogOut,
  Pencil,
  UserX,
  RefreshCw,
  Lock,
  Unlock,
  FileText,
  MessagesSquare,
  Clock,
} from "lucide-react";
import { useInterfaceMode } from "@/lib/interface-mode";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { UploadDropzone } from "@/components/upload-dropzone";
import { RoomChat } from "@/components/room-chat";
import { PomodoroTimer } from "@/components/pomodoro-timer";
import { ActivityFeed } from "@/components/activity-feed";
import { useToast } from "@/components/ui/toast";
import { useTeamChannel } from "@/hooks/use-team-channel";
import { MAX_TEAM_MEMBERS } from "@/lib/teams";

type Member = { id: string; name: string | null; email: string; role: "OWNER" | "MEMBER" };
type TeamDocument = {
  id: string;
  title: string;
  fileSize: number;
  pageCount: number | null;
  status: string;
  createdAt: string;
  user: { name: string | null; email: string };
};

const STATUS_TONE: Record<string, "warning" | "success" | "danger"> = {
  processing: "warning",
  ready: "success",
  error: "danger",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TeamWorkspace({
  team,
  documents,
}: {
  team: {
    id: string;
    name: string;
    inviteCode: string;
    myRole: "OWNER" | "MEMBER";
    closedAt: string | null;
    members: Member[];
  };
  documents: TeamDocument[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"document" | "chat" | "room">("document");
  const { mode } = useInterfaceMode();
  const isHost = team.myRole === "OWNER";

  useEffect(() => {
    fetch(`/api/teams/${team.id}/permissions`)
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, boolean> = {};
        for (const p of data.permissions ?? []) map[p.userId] = p.canEdit;
        setEditPermissions(map);
      })
      .catch(() => {});
  }, [team.id]);

  const handleChannel = useCallback(
    (channel: Channel) => {
      channel.bind("document-uploaded", (data: { title: string }) => {
        toast.show(`New document uploaded: "${data.title}"`, "success");
        router.refresh();
      });
      channel.bind("member-joined", () => router.refresh());
      channel.bind("member-left", () => router.refresh());
      channel.bind("member-kicked", (data: { kickedUserId: string }) => {
        if (data.kickedUserId === session?.user?.id) {
          toast.show("You were removed from this room by the host.", "error");
          router.push("/dashboard");
          return;
        }
        router.refresh();
      });
      channel.bind("edit-permission-changed", (data: { userId: string; canEdit: boolean }) => {
        setEditPermissions((prev) => ({ ...prev, [data.userId]: data.canEdit }));
        if (data.userId === session?.user?.id) {
          toast.show(data.canEdit ? "The host granted you edit access." : "The host revoked your edit access.", data.canEdit ? "success" : "default");
        }
      });
      channel.bind("pomodoro-started", () => {
        if (!isHost) toast.show("The host started a Pomodoro session.", "success");
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [team.id, session?.user?.id, isHost]
  );

  useTeamChannel(team.id, handleChannel);

  async function copyInviteCode() {
    await navigator.clipboard.writeText(team.inviteCode).catch(() => {});
    setCopied(true);
    toast.show("Invite code copied.", "success");
    setTimeout(() => setCopied(false), 2000);
  }

  async function regenerateCode() {
    if (!confirm("Generate a new invite code? The old code will stop working immediately.")) return;
    const res = await fetch(`/api/teams/${team.id}/regenerate-code`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.show(data.error || "Failed to regenerate code.", "error");
      return;
    }
    toast.show("New invite code generated.", "success");
    router.refresh();
  }

  async function toggleRoomClosed() {
    const closing = !team.closedAt;
    if (closing && !confirm("Close this room? Members won't be able to join or edit until you reopen it.")) return;
    const res = await fetch(`/api/teams/${team.id}/close`, { method: closing ? "POST" : "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.show(data.error || "Failed to update room status.", "error");
      return;
    }
    router.refresh();
  }

  async function toggleEditAccess(userId: string) {
    const canEdit = !editPermissions[userId];
    setBusyUserId(userId);
    try {
      const res = await fetch(`/api/teams/${team.id}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, canEdit }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.show(data.error || "Failed to update edit access.", "error");
        return;
      }
      setEditPermissions((prev) => ({ ...prev, [userId]: canEdit }));
    } finally {
      setBusyUserId(null);
    }
  }

  async function kickMember(userId: string, name: string) {
    if (!confirm(`Remove ${name} from this room?`)) return;
    setBusyUserId(userId);
    try {
      const res = await fetch(`/api/teams/${team.id}/kick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.show(data.error || "Failed to remove member.", "error");
        return;
      }
      router.refresh();
    } finally {
      setBusyUserId(null);
    }
  }

  async function leaveTeam() {
    if (!confirm(`Leave "${team.name}"? You'll lose access to its shared documents.`)) return;
    setLeaving(true);
    try {
      const res = await fetch(`/api/teams/${team.id}/leave`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.show(json.error || "Failed to leave team.", "error");
        return;
      }
      router.push("/teams");
      router.refresh();
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <UsersRound size={22} className="text-accent" />
            <span className="truncate">{team.name}</span>
            {team.closedAt && <Badge tone="danger">Closed</Badge>}
          </h1>
          <p className="mt-1 text-sm opacity-70">
            {team.members.length}/{MAX_TEAM_MEMBERS} members ·{" "}
            {documents.length} shared document{documents.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {isHost && (
            <Button variant="secondary" size="sm" onClick={toggleRoomClosed}>
              {team.closedAt ? (
                <>
                  <Unlock size={14} /> Reopen room
                </>
              ) : (
                <>
                  <Lock size={14} /> Close room
                </>
              )}
            </Button>
          )}
          {!isHost && (
            <Button variant="secondary" size="sm" onClick={leaveTeam} disabled={leaving}>
              <LogOut size={14} /> Leave room
            </Button>
          )}
        </div>
      </div>

      {team.closedAt && (
        <Card className="border-red-500/30 p-4 text-sm">
          This room is closed. {isHost ? "Reopen it to allow new uploads, joins, and edits." : "The host has closed it — existing content is still viewable."}
        </Card>
      )}

      {(() => {
        const documentColumn = (
          <div className="flex flex-col gap-6 lg:col-span-2">
            {isHost && !team.closedAt ? (
              <div>
                <h2 className="mb-3 text-lg font-medium">Upload to this room</h2>
                <UploadDropzone teamId={team.id} onUploaded={() => router.refresh()} />
              </div>
            ) : documents.length === 0 ? (
              <p className="text-sm opacity-60">
                Only the host can upload this room&apos;s document — nothing uploaded yet.
              </p>
            ) : null}

            <div>
              <h2 className="mb-3 text-lg font-medium">Team documents</h2>
              {documents.length === 0 ? (
                <EmptyState
                  title="No shared documents yet"
                  description="Upload a PDF above — every team member will be able to view, chat with, summarize, and quiz on it."
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {documents.map((doc) => (
                    <Card key={doc.id} hover className="p-4">
                      <a href={`/documents/${doc.id}`} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{doc.title}</p>
                          <p className="mt-0.5 text-xs opacity-60">
                            {formatBytes(doc.fileSize)}
                            {doc.pageCount ? ` · ${doc.pageCount} pages` : ""}
                          </p>
                          <p className="mt-0.5 text-xs opacity-50">
                            by {doc.user.name || doc.user.email}
                          </p>
                        </div>
                        <Badge tone={STATUS_TONE[doc.status] ?? "neutral"}>{doc.status}</Badge>
                      </a>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

        const roomColumn = (
          <div className="flex flex-col gap-6">
            <PomodoroTimer teamId={team.id} isHost={isHost} />
            <ActivityFeed teamId={team.id} />

            <Card className="p-5">
              <h2 className="mb-3 font-medium">Invite people</h2>
              <p className="mb-3 text-xs opacity-60">Share this code — anyone with it can join the team.</p>
              <button
                onClick={copyInviteCode}
                className="flex w-full items-center justify-between gap-2 rounded-xl bg-black/5 px-3.5 py-2.5 text-left font-mono text-sm transition hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
              >
                <span className="truncate">{team.inviteCode}</span>
                {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} className="opacity-60" />}
              </button>
              {isHost && (
                <button
                  onClick={regenerateCode}
                  className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                >
                  <RefreshCw size={11} /> Generate new code
                </button>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-3 font-medium">Members</h2>
              <div className="flex flex-col gap-3">
                {team.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{m.name || m.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge tone={m.role === "OWNER" ? "accent" : editPermissions[m.id] ? "success" : "neutral"}>
                        {m.role === "OWNER" ? "Host" : editPermissions[m.id] ? "Can edit" : "View only"}
                      </Badge>
                      {isHost && m.role !== "OWNER" && (
                        <>
                          <button
                            onClick={() => toggleEditAccess(m.id)}
                            disabled={busyUserId === m.id}
                            title={editPermissions[m.id] ? "Revoke edit access" : "Grant edit access"}
                            className="rounded-lg p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => kickMember(m.id, m.name || m.email)}
                            disabled={busyUserId === m.id}
                            title="Remove from room"
                            className="rounded-lg p-1 opacity-60 transition hover:bg-red-500/10 hover:text-red-500 hover:opacity-100"
                          >
                            <UserX size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        );

        const chatColumn = <RoomChat teamId={team.id} />;

        if (mode === "mobile") {
          return (
            <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
              <div className={mobileTab === "document" ? "" : "hidden"}>{documentColumn}</div>
              <div className={mobileTab === "chat" ? "" : "hidden"}>{chatColumn}</div>
              <div className={mobileTab === "room" ? "flex flex-col gap-6" : "hidden"}>{roomColumn}</div>
              <MobileTabBar
                tabs={[
                  { value: "document", label: "Document", icon: FileText },
                  { value: "chat", label: "Chat", icon: MessagesSquare },
                  { value: "room", label: "Timer & activity", icon: Clock },
                ]}
                active={mobileTab}
                onChange={setMobileTab}
              />
            </div>
          );
        }

        return (
          <div className="grid gap-6 lg:grid-cols-3">
            {documentColumn}
            <div className="flex flex-col gap-6">
              {roomColumn}
              {chatColumn}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
