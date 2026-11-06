-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('L', 'P');

-- CreateEnum
CREATE TYPE "PosterStatus" AS ENUM ('MASUK', 'DESAIN', 'SIAP', 'POSTING');

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "originalPath" TEXT,
    "cutoutPath" TEXT,
    "status" "PosterStatus" NOT NULL DEFAULT 'MASUK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "letingName" TEXT NOT NULL DEFAULT 'Pusaka Jeumala',
    "target" INTEGER NOT NULL DEFAULT 120,
    "deadline" TIMESTAMP(3),
    "uploadOpen" BOOLEAN NOT NULL DEFAULT true,
    "adminPasswordHash" TEXT,
    "adminPwVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_folder_key" ON "Member"("folder");

-- CreateIndex
CREATE INDEX "Member_createdAt_idx" ON "Member"("createdAt");

-- CreateIndex
CREATE INDEX "Member_status_idx" ON "Member"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Member_countryCode_phone_key" ON "Member"("countryCode", "phone");
