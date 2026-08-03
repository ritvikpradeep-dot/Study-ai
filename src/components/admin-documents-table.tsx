"use client";

import { useState } from "react";
import { Flame, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useInterfaceMode } from "@/lib/interface-mode";

type AdminDocument = {
  id: string;
  title: string;
  fileSize: number;
  pageCount: number | null;
  status: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
  team: { id: string; name: string; shareStruggleData: boolean } | null;
  _count: { quizzes: number; messages: number };
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

export function AdminDocumentsTable({ initialDocuments }: { initialDocuments: AdminDocument[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();
  const { mode } = useInterfaceMode();

  async function removeDocument(id: string, title: string) {
    if (!confirm(`Permanently delete "${title}"? This also deletes its chat, quizzes, and attempts.`)) {
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/documents/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.show(json.error || "Delete failed.", "error");
        return;
      }
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toast.show("Document removed.", "success");
    } catch {
      toast.show("Delete failed.", "error");
    } finally {
      setBusyId(null);
    }
  }

  if (mode === "mobile") {
    return (
      <div className="flex flex-col gap-3">
        {documents.map((d) => (
          <Card key={d.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{d.title}</p>
                <p className="text-xs opacity-60">
                  {formatBytes(d.fileSize)}
                  {d.pageCount ? ` · ${d.pageCount}p` : ""}
                </p>
              </div>
              <Badge tone={STATUS_TONE[d.status] ?? "neutral"}>{d.status}</Badge>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
              <dt className="opacity-60">Owner</dt>
              <dd className="text-right">{d.user.name || d.user.email}</dd>
              <dt className="opacity-60">Team</dt>
              <dd className="text-right">{d.team ? d.team.name : "Personal"}</dd>
              <dt className="opacity-60">Activity</dt>
              <dd className="text-right">
                {d._count.quizzes} quizzes · {d._count.messages} messages
              </dd>
              <dt className="opacity-60">Uploaded</dt>
              <dd className="text-right">{new Date(d.createdAt).toLocaleDateString()}</dd>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" className="min-h-[44px] flex-1" href={`/admin/documents/${d.id}`}>
                <Eye size={14} /> View content
              </Button>
              {d.team?.shareStruggleData && (
                <Button size="sm" variant="secondary" className="min-h-[44px] flex-1" href={`/admin/documents/${d.id}/heatmap`}>
                  <Flame size={14} /> Heatmap
                </Button>
              )}
              <Button
                size="sm"
                variant="danger"
                className="min-h-[44px] flex-1"
                disabled={busyId === d.id}
                onClick={() => removeDocument(d.id, d.title)}
              >
                Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide opacity-60 dark:border-white/10">
            <th className="px-4 py-3 font-medium">Document</th>
            <th className="px-4 py-3 font-medium">Owner</th>
            <th className="px-4 py-3 font-medium">Team</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Activity</th>
            <th className="px-4 py-3 font-medium">Uploaded</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr key={d.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
              <td className="px-4 py-3">
                <p className="max-w-[220px] truncate font-medium">{d.title}</p>
                <p className="text-xs opacity-60">
                  {formatBytes(d.fileSize)}
                  {d.pageCount ? ` · ${d.pageCount}p` : ""}
                </p>
              </td>
              <td className="px-4 py-3 text-xs">
                <p>{d.user.name || d.user.email}</p>
              </td>
              <td className="px-4 py-3 text-xs opacity-70">{d.team ? d.team.name : "Personal"}</td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONE[d.status] ?? "neutral"}>{d.status}</Badge>
              </td>
              <td className="px-4 py-3 text-xs opacity-70">
                {d._count.quizzes} quizzes · {d._count.messages} messages
              </td>
              <td className="px-4 py-3 text-xs opacity-60">{new Date(d.createdAt).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" href={`/admin/documents/${d.id}`}>
                    <Eye size={14} /> View
                  </Button>
                  {d.team?.shareStruggleData && (
                    <Button size="sm" variant="secondary" href={`/admin/documents/${d.id}/heatmap`}>
                      <Flame size={14} /> Heatmap
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busyId === d.id}
                    onClick={() => removeDocument(d.id, d.title)}
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
