"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Page, Thumbnail, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Search,
  PanelLeft,
  Maximize,
  Minimize,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

function IconButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/10"
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function PdfViewer({
  documentId,
  pageCount,
  fullscreen = false,
  onToggleFullscreen,
}: {
  documentId: string;
  pageCount: number | null;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
}) {
  const [numPages, setNumPages] = useState<number>(pageCount ?? 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [searchText, setSearchText] = useState("");
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [loaded, setLoaded] = useState(false);

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
      <div className="glass mb-3 flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2">
        <div className="flex items-center gap-0.5">
          <IconButton
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            label="Previous page"
          >
            <ChevronLeft size={16} />
          </IconButton>
          <span className="min-w-[5.5rem] text-center text-sm tabular-nums">
            {currentPage} / {numPages || "…"}
          </span>
          <IconButton
            onClick={() => setCurrentPage((p) => Math.min(numPages || p, p + 1))}
            disabled={currentPage >= numPages}
            label="Next page"
          >
            <ChevronRight size={16} />
          </IconButton>
        </div>

        <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />

        <div className="flex items-center gap-0.5">
          <IconButton onClick={() => setScale((s) => Math.max(0.5, s - 0.1))} label="Zoom out">
            <ZoomOut size={16} />
          </IconButton>
          <span className="w-11 text-center text-sm tabular-nums">{Math.round(scale * 100)}%</span>
          <IconButton onClick={() => setScale((s) => Math.min(3, s + 0.1))} label="Zoom in">
            <ZoomIn size={16} />
          </IconButton>
        </div>

        <div className="relative min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search in page…"
            className="w-full rounded-lg border border-black/10 bg-transparent py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-accent dark:border-white/10"
          />
        </div>

        <IconButton
          onClick={() => setShowThumbnails((v) => !v)}
          label={showThumbnails ? "Hide thumbnails" : "Show thumbnails"}
        >
          <PanelLeft size={16} />
        </IconButton>

        {onToggleFullscreen && (
          <IconButton
            onClick={onToggleFullscreen}
            label={fullscreen ? "Exit full screen" : "Full screen"}
          >
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </IconButton>
        )}
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
                    n === currentPage ? "border-accent" : "border-transparent"
                  }`}
                >
                  <Thumbnail pageNumber={n} width={90} />
                </button>
              ))}
            </Document>
          </div>
        )}

        <div className="glass flex-1 overflow-auto rounded-2xl p-4">
          {!loaded && (
            <div className="flex flex-col items-center gap-3 p-8">
              <Skeleton className="h-[70vh] w-full max-w-md" />
            </div>
          )}
          <div className={loaded ? "animate-fade-in" : "hidden"}>
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages: n }) => {
                setNumPages(n);
                setLoaded(true);
              }}
              error={<p className="p-8 text-center text-sm text-red-500">Failed to load PDF.</p>}
            >
              <Page
                key={currentPage}
                pageNumber={currentPage}
                scale={scale}
                className="animate-fade-in"
                customTextRenderer={searchText ? ({ str }) => highlightPattern(str) : undefined}
                renderAnnotationLayer
                renderTextLayer
              />
            </Document>
          </div>
        </div>
      </div>
    </div>
  );
}
