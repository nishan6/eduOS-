/*
  Warnings:

  - Added the required column `gradingScale` to the `Exam` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passPercent` to the `Exam` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GradingScale" AS ENUM ('CBSE_9_POINT', 'AP_SSC_9_POINT');

-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('HOLIDAY', 'EXAM', 'EVENT', 'MEETING');

-- CreateEnum
CREATE TYPE "EventAudience" AS ENUM ('EVERYONE', 'STAFF');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('FEES', 'ACADEMICS', 'TRANSPORT', 'ADMINISTRATION', 'TECHNICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- AlterTable
-- Added nullable first, backfilled from the school at the end of this migration, then made required.
ALTER TABLE "Exam" ADD COLUMN     "gradingScale" "GradingScale",
ADD COLUMN     "passPercent" INTEGER;

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "gradingScale" "GradingScale" NOT NULL DEFAULT 'CBSE_9_POINT',
ADD COLUMN     "passPercent" INTEGER NOT NULL DEFAULT 33;

-- CreateTable
CREATE TABLE "PeriodSlot" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isBreak" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PeriodSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableEntry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "slotId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,

    CONSTRAINT "TimetableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "EventKind" NOT NULL,
    "audience" "EventAudience" NOT NULL DEFAULT 'EVERYONE',
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "studentId" TEXT,
    "raisedById" TEXT NOT NULL,
    "assigneeId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PeriodSlot_schoolId_order_key" ON "PeriodSlot"("schoolId", "order");

-- CreateIndex
CREATE INDEX "TimetableEntry_schoolId_idx" ON "TimetableEntry"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableEntry_sectionId_dayOfWeek_slotId_key" ON "TimetableEntry"("sectionId", "dayOfWeek", "slotId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableEntry_teacherId_dayOfWeek_slotId_key" ON "TimetableEntry"("teacherId", "dayOfWeek", "slotId");

-- CreateIndex
CREATE INDEX "SchoolEvent_schoolId_startsOn_idx" ON "SchoolEvent"("schoolId", "startsOn");

-- CreateIndex
CREATE INDEX "Ticket_schoolId_status_idx" ON "Ticket"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Ticket_raisedById_idx" ON "Ticket"("raisedById");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_schoolId_number_key" ON "Ticket"("schoolId", "number");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "PeriodSlot" ADD CONSTRAINT "PeriodSlot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "PeriodSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolEvent" ADD CONSTRAINT "SchoolEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolEvent" ADD CONSTRAINT "SchoolEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill existing exams with their school's (default) scale, then require it.
UPDATE "Exam" e SET "gradingScale" = s."gradingScale", "passPercent" = s."passPercent" FROM "School" s WHERE s.id = e."schoolId";
ALTER TABLE "Exam" ALTER COLUMN "gradingScale" SET NOT NULL, ALTER COLUMN "passPercent" SET NOT NULL;
