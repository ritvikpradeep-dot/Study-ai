import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UploadDropzone } from "@/components/upload-dropzone";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_STYLES: Record<string, string> = {
  processing: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  ready: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  error: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");

  const documents = await prisma.document.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{session?.user?.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="mt-1 text-sm opacity-70">
          {documents.length} document{documents.length === 1 ? "" : "s"} uploaded
        </p>
      </div>

      <UploadDropzone />

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Your documents</h2>
        {documents.length === 0 ? (
          <p className="rounded-2xl glass px-6 py-8 text-center text-sm opacity-60">
            No documents yet — upload a PDF above to get started.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {documents.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/documents/${doc.id}`}
                  className="glass flex items-center justify-between gap-4 rounded-2xl px-5 py-4 transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{doc.title}</p>
                    <p className="mt-0.5 text-xs opacity-60">
                      {formatBytes(doc.fileSize)}
                      {doc.pageCount ? ` · ${doc.pageCount} pages` : ""} ·{" "}
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                      STATUS_STYLES[doc.status] ?? ""
                    }`}
                  >
                    {doc.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
