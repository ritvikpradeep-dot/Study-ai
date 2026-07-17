"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, UsersRound, LogOut } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { UploadDropzone } from "@/components/upload-dropzone";
import { useToast } from "@/components/ui/toast";

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
    members: Member[];
  };
  documents: TeamDocument[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function copyInviteCode() {
    await navigator.clipboard.writeText(team.inviteCode).catch(() => {});
    setCopied(true);
    toast.show("Invite code copied.", "success");
    setTimeout(() => setCopied(false), 2000);
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <UsersRound size={22} className="text-accent" />
            {team.name}
          </h1>
          <p className="mt-1 text-sm opacity-70">
            {team.members.length} member{team.members.length === 1 ? "" : "s"} ·{" "}
            {documents.length} shared document{documents.length === 1 ? "" : "s"}
          </p>
        </div>
        {team.myRole !== "OWNER" && (
          <Button variant="secondary" size="sm" onClick={leaveTeam} disabled={leaving}>
            <LogOut size={14} /> Leave team
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div>
            <h2 className="mb-3 text-lg font-medium">Upload to this team</h2>
            <UploadDropzone teamId={team.id} onUploaded={() => router.refresh()} />
          </div>

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

        <div className="flex flex-col gap-6">
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
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-medium">Members</h2>
            <div className="flex flex-col gap-2.5">
              {team.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{m.name || m.email}</p>
                  </div>
                  <Badge tone={m.role === "OWNER" ? "accent" : "neutral"}>
                    {m.role === "OWNER" ? "Owner" : "Member"}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
