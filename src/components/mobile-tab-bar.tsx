"use client";

import type { LucideIcon } from "lucide-react";

export type MobileTab<T extends string> = { value: T; label: string; icon: LucideIcon };

export function MobileTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: MobileTab<T>[];
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <nav className="safe-bottom glass fixed inset-x-0 bottom-0 z-30 flex border-t">
      {tabs.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition ${
            active === value ? "text-accent" : "opacity-60"
          }`}
        >
          <Icon size={20} />
          {label}
        </button>
      ))}
    </nav>
  );
}
