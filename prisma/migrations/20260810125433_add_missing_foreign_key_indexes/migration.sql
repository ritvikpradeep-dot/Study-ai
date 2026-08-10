-- CreateIndex
CREATE INDEX "ActivityLogEntry_teamId_idx" ON "ActivityLogEntry"("teamId");

-- CreateIndex
CREATE INDEX "ChatMessage_documentId_idx" ON "ChatMessage"("documentId");

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE INDEX "Document_teamId_idx" ON "Document"("teamId");

-- CreateIndex
CREATE INDEX "Drawing_documentId_idx" ON "Drawing"("documentId");

-- CreateIndex
CREATE INDEX "Highlight_documentId_idx" ON "Highlight"("documentId");

-- CreateIndex
CREATE INDEX "RoomMessage_teamId_idx" ON "RoomMessage"("teamId");

-- CreateIndex
CREATE INDEX "StickyNote_documentId_idx" ON "StickyNote"("documentId");
