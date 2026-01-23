-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'user',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "lastLoginAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorEmail" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetEmail" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
