"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { AppearanceMenu } from "@/components/appearance-menu";
import { Button } from "@/components/ui/button";
import { Sparkles, ShieldAlert } from "lucide-react";

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    <header className="safe-top glass sticky top-0 z-40 flex items-center justify-between px-6 py-3">
      <Link
        href={session ? "/dashboard" : "/"}
        className="flex items-center gap-2 font-semibold tracking-tight"
      >
        <Sparkles size={18} className="text-accent" />
        Nous
      </Link>
      <div className="flex items-center gap-2">
        <AppearanceMenu />
        {status === "authenticated" ? (
          <>
            {session.user?.role === "ADMIN" && (
              <Button variant="ghost" size="sm" href="/admin">
                <ShieldAlert size={15} /> Admin
              </Button>
            )}
            <span className="hidden text-sm opacity-70 sm:inline">{session.user?.email}</span>
            <Button variant="secondary" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
              Sign out
            </Button>
          </>
        ) : status === "unauthenticated" ? (
          <>
            <Button variant="ghost" size="sm" href="/login">
              Log in
            </Button>
            <Button variant="primary" size="sm" href="/signup">
              Sign up
            </Button>
          </>
        ) : null}
      </div>
    </header>
  );
}
