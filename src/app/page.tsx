import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Study smarter with an AI that has actually read your PDFs.
      </h1>
      <p className="mt-5 max-w-xl text-lg opacity-70">
        Upload a PDF, get instant summaries, and ask unlimited questions grounded in your own
        documents.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/signup"
          className="rounded-full bg-indigo-600 px-6 py-3 font-medium text-white transition hover:bg-indigo-500"
        >
          Get started free
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-black/10 dark:border-white/10 px-6 py-3 font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
