"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, FileText, UsersRound, ShieldAlert } from "lucide-react";

const TABS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users, exact: false },
  { href: "/admin/rooms", label: "Rooms", icon: UsersRound, exact: false },
  { href: "/admin/documents", label: "Documents", icon: FileText, exact: false },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center gap-2">
        <ShieldAlert size={20} className="text-accent" />
        <h1 className="text-xl font-semibold tracking-tight">Admin panel</h1>
      </div>

      <nav className="glass flex w-fit gap-1 rounded-xl p-1">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm transition ${
                active
                  ? "bg-accent/15 font-medium text-accent"
                  : "opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
