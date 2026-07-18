"use client";

import { useState } from "react";
import { signIn, signOut, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function LoginForm({
  title,
  subtitle,
  callbackUrl,
  requireAdmin = false,
  showSignupLink = true,
  showGoogle = true,
}: {
  title: string;
  subtitle: string;
  callbackUrl: string;
  requireAdmin?: boolean;
  showSignupLink?: boolean;
  showGoogle?: boolean;
}) {
  const router = useRouter();
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setLoading(false);
      setError("Invalid email or password.");
      return;
    }

    if (requireAdmin) {
      const session = await getSession();
      if (session?.user?.role !== "ADMIN") {
        await signOut({ redirect: false });
        setLoading(false);
        setError("This account doesn't have admin access.");
        return;
      }
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm opacity-70">{subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-black/10 dark:border-white/10 bg-transparent px-4 py-2.5 outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-black/10 dark:border-white/10 bg-transparent px-4 py-2.5 outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {!requireAdmin && (
          <div className="flex items-center justify-end text-sm">
            <Link href="/forgot-password" className="text-accent hover:underline">
              Forgot password?
            </Link>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-xl bg-accent py-2.5 font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      {showGoogle && (
        <>
          <div className="flex items-center gap-3 text-xs opacity-50">
            <div className="h-px flex-1 bg-current" />
            or
            <div className="h-px flex-1 bg-current" />
          </div>
          <button
            onClick={() => signIn("google", { callbackUrl })}
            disabled={!googleEnabled}
            title={googleEnabled ? undefined : "Google sign-in isn't configured yet (missing AUTH_GOOGLE_ID/SECRET)"}
            className="rounded-xl border border-black/10 dark:border-white/10 py-2.5 font-medium transition hover:bg-black/5 dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue with Google
          </button>
        </>
      )}

      {showSignupLink && (
        <p className="text-center text-sm opacity-70">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-accent hover:underline">
            Sign up
          </Link>
        </p>
      )}
    </div>
  );
}
