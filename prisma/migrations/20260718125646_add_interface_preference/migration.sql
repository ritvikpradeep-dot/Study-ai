-- CreateEnum
CREATE TYPE "InterfacePreference" AS ENUM ('MOBILE', 'DESKTOP');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "interfacePreference" "InterfacePreference";
