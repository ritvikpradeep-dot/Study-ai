"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Page, Thumbnail, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export function PdfViewer({ documentId, pageCount }: { documentId: string; pageCount: number | null }) {
  const [numPages, setNumPages] = useState<number>(pageCount ?? 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [searchText, setSearchText] = useState("");
  const [showThumbnails, setShowThumbnails] = useState(true);

  const fileUrl = useMemo(() => `/api/documents/${documentId}/file`, [documentId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [documentId]);

  const highlightPattern = (text: string) => {
    if (!searchText.trim()) return text;
    const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.replace(new RegExp(`(${escaped})`, "gi"), "<mark>$1</mark>");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="glass flex flex-wrap items-center gap-3 rounded-2xl px-4 py-2 mb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="rounded-lg px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30"
          >
            ◀
          </button>
          <span className="text-sm tabular-nums">
            Page {currentPage} / {numPages || "…"}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages || p, p + 1))}
            disabled={currentPage >= numPages}
            className="rounded-lg px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30"
          >
            ▶
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            className="rounded-lg px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            −
          </button>
          <span className="text-sm tabular-nums w-12 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.1))}
            className="rounded-lg px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            +
          </button>
        </div>

        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search in page…"
          className="min-w-0 flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          onClick={() => setShowThumbnails((v) => !v)}
          className="rounded-lg px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
        >
          {showThumbnails ? "Hide thumbnails" : "Show thumbnails"}
        </button>
      </div>

      <div className="flex flex-1 gap-3 overflow-hidden">
        {showThumbnails && (
          <div className="glass w-28 shrink-0 overflow-y-auto rounded-2xl p-2">
            <Document file={fileUrl} loading={null}>
              {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setCurrentPage(n)}
                  className={`mb-2 block w-full rounded-lg border-2 transition ${
                    n === currentPage ? "border-indigo-500" : "border-transparent"
                  }`}
                >
                  <Thumbnail pageNumber={n} width={90} />
                </button>
              ))}
            </Document>
          </div>
        )}

        <div className="flex-1 overflow-auto rounded-2xl glass p-4">
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={<p className="p-8 text-center text-sm opacity-60">Loading PDF…</p>}
            error={<p className="p-8 text-center text-sm text-red-500">Failed to load PDF.</p>}
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              customTextRenderer={searchText ? ({ str }) => highlightPattern(str) : undefined}
              renderAnnotationLayer
              renderTextLayer
            />
          </Document>
        </div>
      </div>
    </div>
  );
}
