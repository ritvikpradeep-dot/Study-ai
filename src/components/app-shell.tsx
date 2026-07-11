"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, PanelLeftClose, PanelLeftOpen, FileText } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

type DocSummary = { id: string; title: string; status: string };

const COLLAPSE_KEY = "studyai:sidebarCollapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [docs, setDocs] = useState<DocSummary[] | null>(null);

  useEffect(() => {
    setMounted(true);
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data) => setDocs((data.documents ?? []).slice(0, 8)))
      .catch(() => setDocs([]));
  }, [pathname]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  };

  return (
    <div className="flex flex-1">
      <aside
        className={`glass sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 flex-col gap-1 overflow-y-auto rounded-none border-y-0 border-l-0 p-3 transition-[width] duration-200 sm:flex ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <button
          onClick={toggle}
          className="mb-2 flex items-center justify-center self-end rounded-lg p-2 opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>

        <SidebarLink
          href="/dashboard"
          active={pathname === "/dashboard"}
          collapsed={collapsed}
          icon={<LayoutDashboard size={17} />}
          label="Dashboard"
        />

        {!collapsed && (
          <p className="mb-1 mt-4 px-2 text-xs font-medium uppercase tracking-wide opacity-50">
            Recent documents
          </p>
        )}

        {!mounted || docs === null ? (
          <div className="flex flex-col gap-2 px-2 pt-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        ) : docs.length === 0 ? (
          !collapsed && (
            <p className="px-2 pt-1 text-xs opacity-50">No documents yet.</p>
          )
        ) : (
          docs.map((doc) => (
            <SidebarLink
              key={doc.id}
              href={`/documents/${doc.id}`}
              active={pathname === `/documents/${doc.id}`}
              collapsed={collapsed}
              icon={<FileText size={17} />}
              label={doc.title}
            />
          ))
        )}
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

function SidebarLink({
  href,
  active,
  collapsed,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  collapsed: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  const link = (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition ${
        active
          ? "bg-accent/15 font-medium text-accent"
          : "opacity-75 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
      } ${collapsed ? "justify-center" : ""}`}
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  return collapsed ? (
    <Tooltip label={label} side="top">
      {link}
    </Tooltip>
  ) : (
    link
  );
}
