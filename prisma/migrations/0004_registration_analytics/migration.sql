DROP TABLE IF EXISTS "EnrollmentInvite";
CREATE TABLE "MemberLoginEvent" (
 "id" TEXT NOT NULL,
 "memberId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "MemberLoginEvent_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "MemberLoginEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "MemberLoginEvent_createdAt_idx" ON "MemberLoginEvent"("createdAt");
CREATE INDEX "MemberLoginEvent_memberId_createdAt_idx" ON "MemberLoginEvent"("memberId", "createdAt");
