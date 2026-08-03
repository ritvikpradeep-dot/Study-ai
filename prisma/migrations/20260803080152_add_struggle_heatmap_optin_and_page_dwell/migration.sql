-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "shareStruggleData" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PageDwell" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageDwell_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PageDwell_documentId_userId_page_key" ON "PageDwell"("documentId", "userId", "page");

-- AddForeignKey
ALTER TABLE "PageDwell" ADD CONSTRAINT "PageDwell_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageDwell" ADD CONSTRAINT "PageDwell_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
