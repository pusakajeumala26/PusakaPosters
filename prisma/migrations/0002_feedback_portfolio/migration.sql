-- CreateEnum
CREATE TYPE "FeedbackSync" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "message" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "avatarKey" TEXT,
    "syncStatus" "FeedbackSync" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "uncertain" BOOLEAN NOT NULL DEFAULT false,
    "remoteId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioConnection" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "url" TEXT,
    "keyEnc" TEXT,
    "keyHint" TEXT,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "lastTestAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "lastTestKind" TEXT,
    "lastTestMs" INTEGER,
    "lastTestNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_syncStatus_nextAttemptAt_idx" ON "Feedback"("syncStatus", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");
