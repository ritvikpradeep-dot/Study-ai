-- CreateEnum
CREATE TYPE "DrawingPenType" AS ENUM ('PEN', 'HIGHLIGHTER', 'MARKER');

-- AlterTable
ALTER TABLE "Drawing" ADD COLUMN     "penType" "DrawingPenType" NOT NULL DEFAULT 'PEN';

-- CreateTable
CREATE TABLE "StickyNote" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StickyNote_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StickyNote" ADD CONSTRAINT "StickyNote_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StickyNote" ADD CONSTRAINT "StickyNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
