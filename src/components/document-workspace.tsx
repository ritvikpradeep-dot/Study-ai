"use client";

import { useCallback, useRef, useState } from "react";
import { PdfViewer } from "@/components/pdf-viewer";
import { DocumentTabs } from "@/components/document-tabs";

const MIN_WIDTH = 300;
const MAX_WIDTH = 640;

export function DocumentWorkspace({
  documentId,
  title,
  pageCount,
}: {
  documentId: string;
  title: string;
  pageCount: number | null;
}) {
  const [toolsWidth, setToolsWidth] = useState(380);
  const [fullscreen, setFullscreen] = useState(false);
  const dragging = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const container = e.currentTarget.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const newWidth = rect.right - e.clientX;
    setToolsWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 p-4">
      <div className="min-w-0 flex-1">
        <PdfViewer
          documentId={documentId}
          pageCount={pageCount}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((v) => !v)}
        />
      </div>

      {!fullscreen && (
        <>
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="mx-1.5 w-1.5 shrink-0 cursor-col-resize rounded-full bg-transparent transition hover:bg-accent/40 active:bg-accent/60"
          />
          <div className="shrink-0" style={{ width: toolsWidth }}>
            <DocumentTabs documentId={documentId} title={title} />
          </div>
        </>
      )}
    </div>
  );
}
