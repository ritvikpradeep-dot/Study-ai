"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  createdAt: string;
  _count: { documents: number; ownedTeams: number; teamMembers: number };
};

export function AdminUsersTable({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AdminUser[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();

  async function patchUser(id: string, data: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.show(json.error || "Update failed.", "error");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...json.user } : u)));
      toast.show("Updated.", "success");
    } catch {
      toast.show("Update failed.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function removeUser(id: string, email: string) {
    if (!confirm(`Permanently remove ${email}? This deletes their documents, quizzes, and teams they own.`)) {
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.show(json.error || "Remove failed.", "error");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.show("User removed.", "success");
    } catch {
      toast.show("Remove failed.", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide opacity-60 dark:border-white/10">
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Docs / Teams</th>
            <th className="px-4 py-3 font-medium">Joined</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
              <td className="px-4 py-3">
                <p className="font-medium">{u.name || "—"}</p>
                <p className="text-xs opacity-60">{u.email}</p>
              </td>
              <td className="px-4 py-3">
                <Badge tone={u.role === "ADMIN" ? "accent" : "neutral"}>{u.role}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge tone={u.isActive ? "success" : "danger"}>{u.isActive ? "active" : "deactivated"}</Badge>
              </td>
              <td className="px-4 py-3 text-xs opacity-70">
                {u._count.documents} docs · {u._count.ownedTeams} owned · {u._count.teamMembers} member of
              </td>
              <td className="px-4 py-3 text-xs opacity-60">{new Date(u.createdAt).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                {u.id === currentUserId ? (
                  <span className="text-xs opacity-50">This is you</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyId === u.id}
                      onClick={() => patchUser(u.id, { isActive: !u.isActive })}
                    >
                      {u.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyId === u.id}
                      onClick={() => patchUser(u.id, { role: u.role === "ADMIN" ? "USER" : "ADMIN" })}
                    >
                      {u.role === "ADMIN" ? "Revoke admin" : "Make admin"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busyId === u.id}
                      onClick={() => removeUser(u.id, u.email)}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
