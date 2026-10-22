import { AppShell } from "@/components/shell/app-shell";
import { prisma } from "@/lib/db";
import { buildNavigation } from "@/lib/navigation";
import { hasAnywhere } from "@/lib/permissions/evaluate";
import { getActiveSchool } from "@/lib/tenant/active-school";
import { requireActor } from "@/server/actor";

const ROLE_LABELS: Record<string, string> = {
  org_owner: "Owner", group_admin: "Group admin", principal: "Principal", vice_principal: "Vice principal", teacher: "Teacher",
  accounts_admin: "Accounts admin", accountant: "Cashier", admissions_officer: "Admissions", parent: "Parent", platform_admin: "Platform admin",
  school_management: "Management", front_office: "Front office",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const school = await getActiveSchool(actor);
  const [unread, year] = await Promise.all([
    prisma.notification.count({ where: { userId: actor.userId, readAt: null } }),
    school ? prisma.academicYear.findFirst({ where: { schoolId: school.id, isCurrent: true }, select: { name: true } }) : null,
  ]);
  return (
    <AppShell
      nav={buildNavigation(actor, school)}
      schools={actor.schools.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
      activeSchoolId={school?.id ?? null}
      user={{ name: actor.name, email: actor.email, roleLabel: actor.roleKeys.map((k) => ROLE_LABELS[k] ?? k).join(", ") || "No role" }}
      unread={unread}
      academicYear={year?.name ?? null}
      canSearchStudents={!!school && hasAnywhere(actor, "students.read", school.id)}
    >
      {children}
    </AppShell>
  );
}
