"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor, Palette } from "lucide-react";

const ACCENTS: { name: string; value: string }[] = [
  { name: "Indigo", value: "#4f46e5" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Blue", value: "#2563eb" },
  { name: "Emerald", value: "#059669" },
  { name: "Rose", value: "#e11d48" },
];

const ACCENT_STORAGE_KEY = "studyai:accent";

export function AppearanceMenu() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [accent, setAccent] = useState(ACCENTS[0].value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    if (stored) setAccent(stored);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const applyAccent = (value: string) => {
    setAccent(value);
    document.documentElement.style.setProperty("--accent", value);
    window.localStorage.setItem(ACCENT_STORAGE_KEY, value);
  };

  if (!mounted) return <div className="h-9 w-9" />;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Appearance settings"
        className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
      >
        <Palette size={17} />
      </button>

      {open && (
        <div className="animate-scale-in glass absolute right-0 top-11 z-50 w-56 rounded-2xl p-3 shadow-xl">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide opacity-60">Theme</p>
          <div className="mb-3 flex gap-1 rounded-xl bg-black/5 dark:bg-white/10 p-1">
            {[
              { value: "light", icon: Sun, label: "Light" },
              { value: "dark", icon: Moon, label: "Dark" },
              { value: "system", icon: Monitor, label: "System" },
            ].map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                aria-label={label}
                className={`flex flex-1 items-center justify-center rounded-lg py-1.5 transition ${
                  theme === value ? "bg-white dark:bg-black shadow" : "opacity-60"
                }`}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>

          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide opacity-60">
            Accent color
          </p>
          <div className="flex gap-2 px-1">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                onClick={() => applyAccent(a.value)}
                aria-label={a.name}
                title={a.name}
                className={`h-7 w-7 rounded-full transition ${
                  accent === a.value
                    ? "ring-2 ring-offset-2 ring-offset-[var(--background)]"
                    : "hover:scale-110"
                }`}
                style={{ backgroundColor: a.value, ["--tw-ring-color" as string]: a.value }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
