"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDropzone({
  onUploaded,
  teamId,
}: {
  onUploaded?: () => void;
  teamId?: string;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      setProgressLabel(`Uploading ${file.name} (${formatBytes(file.size)})…`);

      const formData = new FormData();
      formData.append("file", file);
      if (teamId) formData.append("teamId", teamId);

      try {
        const res = await fetch("/api/documents", { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Upload failed.");
          return;
        }
        setProgressLabel("Processing complete.");
        onUploaded?.();
        router.refresh();
      } catch {
        setError("Upload failed. Check your connection and try again.");
      } finally {
        setUploading(false);
        setTimeout(() => setProgressLabel(null), 1500);
      }
    },
    [onUploaded, router, teamId]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) upload(file);
    },
    [upload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: uploading,
  });

  return (
    <div className="flex flex-col gap-2">
      <div
        {...getRootProps()}
        className={`glass flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          isDragActive
            ? "border-accent bg-accent/5"
            : "border-black/15 dark:border-white/15"
        } ${uploading ? "cursor-not-allowed opacity-70" : ""}`}
      >
        <input {...getInputProps()} />
        <p className="font-medium">
          {isDragActive ? "Drop your PDF here" : "Drag & drop a PDF, or click to browse"}
        </p>
        <p className="text-sm opacity-60">PDF only for now · up to 50MB</p>
      </div>
      {progressLabel && <p className="text-sm opacity-70">{progressLabel}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
