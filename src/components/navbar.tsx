"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function Navbar() {
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="glass sticky top-0 z-40 flex items-center justify-between px-6 py-3">
      <Link href={session ? "/dashboard" : "/"} className="font-semibold tracking-tight">
        StudyAI
      </Link>
      <div className="flex items-center gap-3">
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-full px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        )}
        {status === "authenticated" ? (
          <>
            <span className="text-sm opacity-70 hidden sm:inline">{session.user?.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-full bg-black/5 dark:bg-white/10 px-4 py-1.5 text-sm hover:bg-black/10 dark:hover:bg-white/20 transition"
            >
              Sign out
            </button>
          </>
        ) : status === "unauthenticated" ? (
          <>
            <Link
              href="/login"
              className="rounded-full px-4 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 transition"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-indigo-600 text-white px-4 py-1.5 text-sm hover:bg-indigo-500 transition"
            >
              Sign up
            </Link>
          </>
        ) : null}
      </div>
    </header>
  );
}
