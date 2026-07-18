-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityAction" ADD VALUE 'DRAWING_ADDED';
ALTER TYPE "ActivityAction" ADD VALUE 'STICKY_NOTE_ADDED';
ALTER TYPE "ActivityAction" ADD VALUE 'MEMBER_LEFT';
ALTER TYPE "ActivityAction" ADD VALUE 'MEMBER_KICKED';
ALTER TYPE "ActivityAction" ADD VALUE 'EDIT_ACCESS_GRANTED';
ALTER TYPE "ActivityAction" ADD VALUE 'EDIT_ACCESS_REVOKED';
ALTER TYPE "ActivityAction" ADD VALUE 'POMODORO_STOPPED';
ALTER TYPE "ActivityAction" ADD VALUE 'ROOM_CLOSED';
ALTER TYPE "ActivityAction" ADD VALUE 'INVITE_CODE_REGENERATED';

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "closedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EditPermission" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canEdit" BOOLEAN NOT NULL DEFAULT true,
    "grantedByHostAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EditPermission_teamId_userId_key" ON "EditPermission"("teamId", "userId");

-- AddForeignKey
ALTER TABLE "EditPermission" ADD CONSTRAINT "EditPermission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditPermission" ADD CONSTRAINT "EditPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
