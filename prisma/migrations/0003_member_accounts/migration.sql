-- Member-owned, revocable sessions and one-time registration invitations.
CREATE TABLE "MemberSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MemberSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MemberSession_tokenHash_key" ON "MemberSession"("tokenHash");
CREATE INDEX "MemberSession_memberId_expiresAt_idx" ON "MemberSession"("memberId", "expiresAt");

CREATE TABLE "EnrollmentInvite" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnrollmentInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EnrollmentInvite_codeHash_key" ON "EnrollmentInvite"("codeHash");
CREATE INDEX "EnrollmentInvite_expiresAt_usedAt_idx" ON "EnrollmentInvite"("expiresAt", "usedAt");

CREATE TABLE "AuthThrottle" (
    "keyHash" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("keyHash")
);
CREATE INDEX "AuthThrottle_resetAt_idx" ON "AuthThrottle"("resetAt");
