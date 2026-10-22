import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit/audit";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { parseInput } from "@/lib/validation";
import { can, canSchoolWide, type Actor } from "@/lib/permissions/evaluate";
import type { PermissionKey } from "@/lib/permissions/catalog";
import { getEmailProvider } from "@/lib/integrations/email";

const INVITE_TTL_HOURS = 72;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const appUrl = () => process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

/** The activation link is only returned to the inviter outside production, so pilots can test without email. */
const exposeLinks = () => process.env.EDUOS_ENV !== "production";

async function issueInvitation(args: {
  organizationId: string; schoolId: string | null; email: string; name: string; roleKey: string; guardianId?: string; invitedById: string;
}) {
  const token = randomBytes(32).toString("base64url");
  const inv = await prisma.invitation.create({
    data: {
      organizationId: args.organizationId, schoolId: args.schoolId, email: args.email.toLowerCase(), name: args.name,
      roleKey: args.roleKey, guardianId: args.guardianId, tokenHash: sha256(token), invitedById: args.invitedById,
      expiresAt: new Date(Date.now() + INVITE_TTL_HOURS * 3600_000),
    },
  });
  const url = `${appUrl()}/activate?token=${token}`;
  const delivery = await getEmailProvider().send({
    to: args.email,
    subject: "You're invited to EduOS",
    body: `Hello ${args.name},\n\nYou have been invited to EduOS. Set your password here (valid ${INVITE_TTL_HOURS} hours):\n${url}`,
  });
  return { invitation: inv, activationUrl: exposeLinks() ? url : null, delivered: delivery.delivered };
}

export const inviteGuardianInput = z.object({ guardianId: z.string().min(1), email: z.email("Enter a valid email") });

/** Gives a guardian a login to the family app. Requires guardians.manage in a school where one of their children studies. */
export async function inviteGuardian(actor: Actor, raw: z.input<typeof inviteGuardianInput>) {
  const input = parseInput(inviteGuardianInput, raw);
  const guardian = await prisma.guardian.findUnique({ where: { id: input.guardianId }, include: { students: { include: { student: true } } } });
  if (!guardian) throw notFound("Guardian");
  const schoolId = guardian.students.map((l) => l.student.schoolId).find((sid) => can(actor, "guardians.manage", { schoolId: sid }));
  if (!schoolId) throw forbidden();
  if (guardian.userId) throw conflict("This guardian already has an EduOS login.");
  await prisma.guardian.update({ where: { id: guardian.id }, data: { email: input.email } });
  const result = await issueInvitation({
    organizationId: guardian.organizationId, schoolId: null, email: input.email, name: guardian.name,
    roleKey: "parent", guardianId: guardian.id, invitedById: actor.userId,
  });
  await audit({ actorUserId: actor.userId, organizationId: guardian.organizationId, schoolId, action: "identity.invite.guardian", entityType: "Guardian", entityId: guardian.id, summary: `Invited guardian ${guardian.name} to the family app` });
  return result;
}

export const inviteStaffInput = z.object({
  schoolId: z.string().min(1),
  email: z.email("Enter a valid email"),
  name: z.string().trim().min(2).max(120),
  roleKey: z.string().min(1),
});

/** Invites a staff member into one school with one role. The inviter must already hold every permission the role grants. */
export async function inviteStaff(actor: Actor, raw: z.input<typeof inviteStaffInput>) {
  const input = parseInput(inviteStaffInput, raw);
  if (!canSchoolWide(actor, "users.manage", input.schoolId)) throw forbidden();
  const school = await prisma.school.findUniqueOrThrow({ where: { id: input.schoolId } });
  const role = await prisma.role.findUnique({
    where: { organizationId_key: { organizationId: school.organizationId, key: input.roleKey } },
    include: { permissions: true },
  });
  if (!role || role.key === "parent" || role.key === "platform_admin") throw invalid("Choose a valid staff role.");
  const escalates = role.permissions.some((p) => !can(actor, p.permissionKey as PermissionKey, { schoolId: school.id }));
  if (escalates) throw forbidden("You cannot grant a role with permissions you do not hold yourself.");
  const result = await issueInvitation({
    organizationId: school.organizationId, schoolId: school.id, email: input.email, name: input.name,
    roleKey: role.key, invitedById: actor.userId,
  });
  await audit({ actorUserId: actor.userId, organizationId: school.organizationId, schoolId: school.id, action: "identity.invite.staff", entityType: "Invitation", entityId: result.invitation.id, summary: `Invited ${input.email} as ${role.name}` });
  return result;
}

export async function getInvitationByToken(token: string) {
  const inv = await prisma.invitation.findUnique({ where: { tokenHash: sha256(token) } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) return null;
  return { email: inv.email, name: inv.name, existingUser: !!(await prisma.user.findUnique({ where: { email: inv.email } })) };
}

export const acceptInput = z
  .object({
    token: z.string().min(10),
    password: z.string().min(10, "Use at least 10 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

/** Accepts an invitation: creates the login (or links an existing one), grants the role, links the guardian. */
export async function acceptInvitation(raw: z.input<typeof acceptInput>) {
  const input = parseInput(acceptInput, raw);
  const inv = await prisma.invitation.findUnique({ where: { tokenHash: sha256(input.token) } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) throw invalid("This invitation link is invalid or has expired. Ask the school to send a new one.");
  const role = await prisma.role.findUnique({ where: { organizationId_key: { organizationId: inv.organizationId, key: inv.roleKey } } });
  if (!role) throw invalid("The invited role no longer exists.");
  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.invitation.updateMany({ where: { id: inv.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
    if (claimed.count !== 1) throw conflict("This invitation has already been used.");
    let user = await tx.user.findUnique({ where: { email: inv.email } });
    if (!user) {
      user = await tx.user.create({ data: { email: inv.email, name: inv.name, emailVerified: true, status: "ACTIVE" } });
      await tx.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: passwordHash } });
    }
    if (inv.schoolId) {
      await tx.userSchoolMembership.upsert({
        where: { userId_schoolId: { userId: user.id, schoolId: inv.schoolId } },
        create: { userId: user.id, schoolId: inv.schoolId },
        update: { status: "ACTIVE" },
      });
    }
    const existingAssignment = await tx.userRoleAssignment.findFirst({
      where: { userId: user.id, roleId: role.id, organizationId: inv.organizationId, schoolId: inv.schoolId },
    });
    if (!existingAssignment) {
      await tx.userRoleAssignment.create({
        data: { userId: user.id, roleId: role.id, organizationId: inv.organizationId, schoolId: inv.schoolId, createdById: inv.invitedById },
      });
    }
    if (inv.guardianId) await tx.guardian.update({ where: { id: inv.guardianId }, data: { userId: user.id } });
    await audit({ actorUserId: user.id, organizationId: inv.organizationId, schoolId: inv.schoolId, action: "identity.invite.accept", entityType: "User", entityId: user.id, summary: `${inv.email} accepted invitation as ${role.name}` }, tx);
    return { email: user.email, linkedExisting: !!existingAssignment || user.createdAt < inv.createdAt };
  });
}

export async function listSchoolUsers(actor: Actor, schoolId: string) {
  if (!canSchoolWide(actor, "users.read", schoolId)) throw forbidden();
  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
  const [members, orgWide, invitations, roles] = await Promise.all([
    prisma.userSchoolMembership.findMany({
      where: { schoolId },
      include: { user: { include: { roleAssignments: { where: { OR: [{ schoolId }, { schoolId: null, organizationId: school.organizationId }] }, include: { role: true } } } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.userRoleAssignment.findMany({
      where: { organizationId: school.organizationId, schoolId: null, role: { key: { not: "parent" } } },
      include: { user: true, role: true },
    }),
    prisma.invitation.findMany({ where: { schoolId, acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
    prisma.role.findMany({ where: { organizationId: school.organizationId, key: { notIn: ["parent", "platform_admin", "student"] } }, orderBy: { name: "asc" } }),
  ]);
  return {
    members: members.map((m) => ({
      id: m.user.id, name: m.user.name, email: m.user.email, status: m.user.status, membershipStatus: m.status,
      roles: m.user.roleAssignments.map((a) => a.role.name),
    })),
    orgWide: orgWide.map((a) => ({ id: a.user.id, name: a.user.name, email: a.user.email, role: a.role.name })),
    invitations,
    roles,
  };
}

/** Suspends or reactivates a user's access to one school. Suspension also revokes their sessions. */
export async function setMembershipStatus(actor: Actor, schoolId: string, userId: string, status: "ACTIVE" | "SUSPENDED") {
  if (!canSchoolWide(actor, "users.manage", schoolId)) throw forbidden();
  if (userId === actor.userId) throw invalid("You cannot change your own access.");
  const m = await prisma.userSchoolMembership.findUnique({ where: { userId_schoolId: { userId, schoolId } }, include: { user: true } });
  if (!m) throw notFound("Membership");
  await prisma.$transaction(async (tx) => {
    await tx.userSchoolMembership.update({ where: { id: m.id }, data: { status } });
    if (status === "SUSPENDED") await tx.session.deleteMany({ where: { userId } });
    await audit({ actorUserId: actor.userId, schoolId, action: status === "SUSPENDED" ? "identity.membership.suspend" : "identity.membership.activate", entityType: "User", entityId: userId, summary: `${status === "SUSPENDED" ? "Suspended" : "Reactivated"} ${m.user.name} in this school` }, tx);
  });
}
