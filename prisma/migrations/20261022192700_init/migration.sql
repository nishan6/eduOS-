-- CreateEnum
CREATE TYPE "Board" AS ENUM ('CBSE', 'AP_STATE', 'ICSE', 'IB', 'OTHER');

-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('ACTIVE', 'ONBOARDING', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('ORGANIZATION', 'SCHOOL', 'ASSIGNED', 'OWN_FAMILY', 'SELF');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ALUMNI', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'TRANSFERRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "GuardianRelation" AS ENUM ('FATHER', 'MOTHER', 'GUARDIAN', 'GRANDPARENT', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendanceSessionStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('RECORDED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentVerification" AS ENUM ('UNVERIFIED', 'VERIFIED', 'DISCREPANCY');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY');

-- CreateEnum
CREATE TYPE "JournalSource" AS ENUM ('MANUAL', 'PAYMENT', 'PAYMENT_REVERSAL', 'INVOICE');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "board" "Board" NOT NULL,
    "status" "SchoolStatus" NOT NULL DEFAULT 'ACTIVE',
    "city" TEXT,
    "state" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "brandColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hasHostel" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campus" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,

    CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "phone" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "twoFactorEnabled" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "scope" "PermissionScope" NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionKey")
);

-- CreateTable
CREATE TABLE "UserSchoolMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSchoolMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schoolId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "guardianId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "schoolId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevOutboxMessage" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevOutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "schoolId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("schoolId","key")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT,
    "isClassTeacher" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentStatusHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromStatus" "StudentStatus",
    "toStatus" "StudentStatus" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEnrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "rollNo" INTEGER,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "occupation" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMembership" (
    "familyId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,

    CONSTRAINT "FamilyMembership_pkey" PRIMARY KEY ("familyId","guardianId")
);

-- CreateTable
CREATE TABLE "StudentGuardianRelationship" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relation" "GuardianRelation" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "canViewFees" BOOLEAN NOT NULL DEFAULT true,
    "canPickup" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentGuardianRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "period" INTEGER NOT NULL DEFAULT 0,
    "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "markedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "remark" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCorrectionRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "fromStatus" "AttendanceStatus" NOT NULL,
    "toStatus" "AttendanceStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeCategory" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FeeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "gradeId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeComponent" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,

    CONSTRAINT "FeeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFeeAssignment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentFeeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "totalPaise" INTEGER NOT NULL,
    "paidPaise" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "componentId" TEXT,
    "description" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "reference" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "verification" "PaymentVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "idempotencyKey" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "reversedById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "tallyLedgerName" TEXT,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "narration" TEXT NOT NULL,
    "source" "JournalSource" NOT NULL,
    "sourceId" TEXT,
    "reversesId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debitPaise" INTEGER NOT NULL DEFAULT 0,
    "creditPaise" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "School_organizationId_idx" ON "School"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "School_organizationId_code_key" ON "School"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Campus_schoolId_idx" ON "Campus"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Role_organizationId_key_key" ON "Role"("organizationId", "key");

-- CreateIndex
CREATE INDEX "UserSchoolMembership_schoolId_idx" ON "UserSchoolMembership"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSchoolMembership_userId_schoolId_key" ON "UserSchoolMembership"("userId", "schoolId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_userId_idx" ON "UserRoleAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_schoolId_idx" ON "UserRoleAssignment"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRoleAssignment_userId_roleId_organizationId_schoolId_key" ON "UserRoleAssignment"("userId", "roleId", "organizationId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_createdAt_idx" ON "AuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AcademicYear_schoolId_isCurrent_idx" ON "AcademicYear"("schoolId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_schoolId_name_key" ON "AcademicYear"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_schoolId_name_key" ON "Grade"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Section_schoolId_academicYearId_idx" ON "Section"("schoolId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_gradeId_academicYearId_name_key" ON "Section"("gradeId", "academicYearId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_schoolId_code_key" ON "Subject"("schoolId", "code");

-- CreateIndex
CREATE INDEX "TeacherAssignment_schoolId_userId_idx" ON "TeacherAssignment"("schoolId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAssignment_userId_sectionId_subjectId_key" ON "TeacherAssignment"("userId", "sectionId", "subjectId");

-- CreateIndex
CREATE INDEX "Student_schoolId_lastName_firstName_idx" ON "Student"("schoolId", "lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Student_schoolId_admissionNo_key" ON "Student"("schoolId", "admissionNo");

-- CreateIndex
CREATE INDEX "StudentStatusHistory_studentId_idx" ON "StudentStatusHistory"("studentId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_sectionId_idx" ON "StudentEnrollment"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEnrollment_studentId_academicYearId_key" ON "StudentEnrollment"("studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_userId_key" ON "Guardian"("userId");

-- CreateIndex
CREATE INDEX "Guardian_organizationId_email_idx" ON "Guardian"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_organizationId_phone_key" ON "Guardian"("organizationId", "phone");

-- CreateIndex
CREATE INDEX "StudentGuardianRelationship_guardianId_idx" ON "StudentGuardianRelationship"("guardianId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardianRelationship_studentId_guardianId_key" ON "StudentGuardianRelationship"("studentId", "guardianId");

-- CreateIndex
CREATE INDEX "AttendanceSession_schoolId_date_idx" ON "AttendanceSession"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSession_sectionId_date_period_key" ON "AttendanceSession"("sectionId", "date", "period");

-- CreateIndex
CREATE INDEX "StudentAttendance_studentId_idx" ON "StudentAttendance"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAttendance_sessionId_studentId_key" ON "StudentAttendance"("sessionId", "studentId");

-- CreateIndex
CREATE INDEX "AttendanceCorrectionRequest_schoolId_status_idx" ON "AttendanceCorrectionRequest"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FeeCategory_schoolId_code_key" ON "FeeCategory"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructure_schoolId_academicYearId_name_key" ON "FeeStructure"("schoolId", "academicYearId", "name");

-- CreateIndex
CREATE INDEX "FeeComponent_structureId_idx" ON "FeeComponent"("structureId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFeeAssignment_studentId_structureId_key" ON "StudentFeeAssignment"("studentId", "structureId");

-- CreateIndex
CREATE INDEX "Invoice_studentId_status_idx" ON "Invoice"("studentId", "status");

-- CreateIndex
CREATE INDEX "Invoice_schoolId_status_dueDate_idx" ON "Invoice"("schoolId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_schoolId_number_key" ON "Invoice"("schoolId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLineItem_invoiceId_componentId_key" ON "InvoiceLineItem"("invoiceId", "componentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_schoolId_receivedAt_idx" ON "Payment"("schoolId", "receivedAt");

-- CreateIndex
CREATE INDEX "Payment_studentId_idx" ON "Payment"("studentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_invoiceId_key" ON "PaymentAllocation"("paymentId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_schoolId_number_key" ON "Receipt"("schoolId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_schoolId_code_key" ON "LedgerAccount"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reversesId_key" ON "JournalEntry"("reversesId");

-- CreateIndex
CREATE INDEX "JournalEntry_schoolId_date_idx" ON "JournalEntry"("schoolId", "date");

-- CreateIndex
CREATE INDEX "JournalEntry_source_sourceId_idx" ON "JournalEntry"("source", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_schoolId_number_key" ON "JournalEntry"("schoolId", "number");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campus" ADD CONSTRAINT "Campus_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionKey_fkey" FOREIGN KEY ("permissionKey") REFERENCES "Permission"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSchoolMembership" ADD CONSTRAINT "UserSchoolMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSchoolMembership" ADD CONSTRAINT "UserSchoolMembership_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStatusHistory" ADD CONSTRAINT "StudentStatusHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyAccount" ADD CONSTRAINT "FamilyAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "FamilyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardianRelationship" ADD CONSTRAINT "StudentGuardianRelationship_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardianRelationship" ADD CONSTRAINT "StudentGuardianRelationship_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "StudentAttendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeCategory" ADD CONSTRAINT "FeeCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeComponent" ADD CONSTRAINT "FeeComponent_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "FeeStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeComponent" ADD CONSTRAINT "FeeComponent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FeeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeAssignment" ADD CONSTRAINT "StudentFeeAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeAssignment" ADD CONSTRAINT "StudentFeeAssignment_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "FeeStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "FeeComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
