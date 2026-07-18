"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, MessagesSquare } from "lucide-react";
import { PdfViewer } from "@/components/pdf-viewer";
import { DocumentTabs } from "@/components/document-tabs";
import type { NotesPanelHandle } from "@/components/notes-panel";
import { useToast } from "@/components/ui/toast";
import { useInterfaceMode } from "@/lib/interface-mode";
import { MobileTabBar } from "@/components/mobile-tab-bar";

const MIN_WIDTH = 300;
const MAX_WIDTH = 640;

export function DocumentWorkspace({
  documentId,
  title,
  pageCount,
  teamId,
  isHost,
  canEdit,
  sharedSummary,
  summaryGeneratedAt,
}: {
  documentId: string;
  title: string;
  pageCount: number | null;
  teamId: string | null;
  isHost: boolean;
  canEdit: boolean;
  sharedSummary: string | null;
  summaryGeneratedAt: string | null;
}) {
  const [toolsWidth, setToolsWidth] = useState(380);
  const [fullscreen, setFullscreen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"document" | "tools">("document");
  const dragging = useRef(false);
  const notesRef = useRef<NotesPanelHandle>(null);
  const toast = useToast();
  const { mode } = useInterfaceMode();

  const handleAddToNotes = useCallback(
    (text: string, page: number) => {
      // The notes panel unmounts in full-screen mode (the tools panel is
      // hidden entirely), so there's nothing to append to until it exits.
      if (!notesRef.current) {
        toast.show("Exit full screen to save highlights to notes.", "error");
        return;
      }
      notesRef.current.appendHighlight(text, page);
      toast.show("Added to notes.", "success");
    },
    [toast]
  );

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

  const documentTabs = (
    <DocumentTabs
      ref={notesRef}
      documentId={documentId}
      title={title}
      teamId={teamId}
      isHost={isHost}
      canEdit={canEdit}
      initialSharedSummary={sharedSummary}
      initialSummaryGeneratedAt={summaryGeneratedAt}
    />
  );

  const pdfViewer = (
    <PdfViewer
      documentId={documentId}
      pageCount={pageCount}
      fullscreen={fullscreen}
      onToggleFullscreen={() => setFullscreen((v) => !v)}
      onAddToNotes={handleAddToNotes}
      shared={Boolean(teamId)}
      canEdit={canEdit}
      teamId={teamId}
    />
  );

  if (mode === "mobile") {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col p-3 pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
        <div className="min-h-0 flex-1">
          <div className={mobilePanel === "document" ? "h-full" : "hidden"}>{pdfViewer}</div>
          <div className={mobilePanel === "tools" ? "h-full" : "hidden"}>{documentTabs}</div>
        </div>
        {!fullscreen && (
          <MobileTabBar
            tabs={[
              { value: "document", label: "Document", icon: FileText },
              { value: "tools", label: "Chat & tools", icon: MessagesSquare },
            ]}
            active={mobilePanel}
            onChange={setMobilePanel}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 p-4">
      <div className="min-w-0 flex-1">{pdfViewer}</div>

      {!fullscreen && (
        <>
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="mx-1.5 w-1.5 shrink-0 cursor-col-resize rounded-full bg-transparent transition hover:bg-accent/40 active:bg-accent/60"
          />
          <div className="shrink-0" style={{ width: toolsWidth }}>
            {documentTabs}
          </div>
        </>
      )}
    </div>
  );
}
