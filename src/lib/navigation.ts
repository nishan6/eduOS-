import { canInOrganization, canSchoolWide, hasAnywhere, hasFamilyPermission, sectionFilter, type Actor, type ActorSchool } from "@/lib/permissions/evaluate";

export type NavIcon =
  | "home" | "family" | "teacher" | "principal" | "owner" | "students" | "attendance" | "fees" | "finance"
  | "school" | "users" | "audit" | "outbox" | "bell" | "homework" | "exams" | "admissions" | "notices"
  | "timetable" | "calendar" | "helpdesk" | "support";

export type NavItem = { href: string; label: string; icon: NavIcon; group: "Home" | "Operations" | "Settings" };

/** Navigation is derived from permissions. Hiding an item is a convenience; pages enforce access themselves. */
export function buildNavigation(actor: Actor, school: ActorSchool | null): NavItem[] {
  const items: NavItem[] = [];
  const sid = school?.id;
  if (school && canInOrganization(actor, "reports.read", school.organizationId)) items.push({ href: "/app/owner", label: "Group overview", icon: "owner", group: "Home" });
  if (sid && canSchoolWide(actor, "attendance.read", sid)) items.push({ href: "/app/principal", label: "School overview", icon: "principal", group: "Home" });
  if (sid && sectionFilter(actor, "attendance.mark", sid) !== "all" && sectionFilter(actor, "attendance.mark", sid).length > 0)
    items.push({ href: "/app/teacher", label: "My classes", icon: "teacher", group: "Home" });
  if (hasFamilyPermission(actor, "family.read")) {
    items.push({ href: "/app/family", label: "My children", icon: "family", group: "Home" });
    items.push({ href: "/app/family/notices", label: "Notices", icon: "notices", group: "Home" });
    items.push({ href: "/app/family/calendar", label: "School calendar", icon: "calendar", group: "Home" });
    if (hasFamilyPermission(actor, "tickets.create")) items.push({ href: "/app/support", label: "Help & requests", icon: "support", group: "Home" });
  }

  if (sid && hasAnywhere(actor, "students.read", sid)) items.push({ href: "/app/students", label: "Students", icon: "students", group: "Operations" });
  if (sid && canSchoolWide(actor, "attendance.read", sid)) items.push({ href: "/app/attendance", label: "Attendance", icon: "attendance", group: "Operations" });
  if (sid && canSchoolWide(actor, "attendance.mark", sid) && !items.some((i) => i.href === "/app/teacher"))
    items.push({ href: "/app/teacher", label: "Mark attendance", icon: "teacher", group: "Operations" });
  if (sid && hasAnywhere(actor, "homework.read", sid)) items.push({ href: "/app/homework", label: "Homework", icon: "homework", group: "Operations" });
  if (sid && hasAnywhere(actor, "exams.read", sid)) items.push({ href: "/app/exams", label: "Exams & marks", icon: "exams", group: "Operations" });
  if (sid && canSchoolWide(actor, "admissions.read", sid)) items.push({ href: "/app/admissions", label: "Admissions", icon: "admissions", group: "Operations" });
  if (sid && hasAnywhere(actor, "announcements.send", sid)) items.push({ href: "/app/notices", label: "Notices", icon: "notices", group: "Operations" });
  if (sid && canSchoolWide(actor, "academics.read", sid)) {
    items.push({ href: "/app/timetable", label: "Timetable", icon: "timetable", group: "Operations" });
    items.push({ href: "/app/calendar", label: "Calendar", icon: "calendar", group: "Operations" });
  }
  if (sid && canSchoolWide(actor, "tickets.manage", sid)) items.push({ href: "/app/helpdesk", label: "Helpdesk", icon: "helpdesk", group: "Operations" });
  if (sid && canSchoolWide(actor, "tickets.create", sid) && !items.some((i) => i.href === "/app/support"))
    items.push({ href: "/app/support", label: "My requests", icon: "support", group: "Operations" });
  if (sid && canSchoolWide(actor, "fees.read", sid)) items.push({ href: "/app/fees", label: "Fees", icon: "fees", group: "Operations" });
  if (sid && canSchoolWide(actor, "finance.ledger.read", sid)) items.push({ href: "/app/finance", label: "Ledger", icon: "finance", group: "Operations" });

  if (sid && canSchoolWide(actor, "academics.read", sid) && canSchoolWide(actor, "settings.manage", sid)) items.push({ href: "/app/settings/school", label: "School setup", icon: "school", group: "Settings" });
  if (sid && canSchoolWide(actor, "users.read", sid)) items.push({ href: "/app/settings/users", label: "Users & roles", icon: "users", group: "Settings" });
  if (sid && canSchoolWide(actor, "audit.read", sid)) items.push({ href: "/app/settings/audit", label: "Audit log", icon: "audit", group: "Settings" });
  if (sid && canSchoolWide(actor, "users.manage", sid) && process.env.EDUOS_ENV !== "production")
    items.push({ href: "/app/settings/outbox", label: "Dev outbox", icon: "outbox", group: "Settings" });
  return items;
}

/** Where to land after sign-in: the most senior home the actor has. */
export function homeFor(actor: Actor, school: ActorSchool | null): string {
  const nav = buildNavigation(actor, school);
  const first = nav.find((n) => n.group === "Home") ?? nav.find((n) => n.href === "/app/fees") ?? nav.find((n) => n.href === "/app/helpdesk") ?? nav[0];
  return first?.href ?? "/app/no-access";
}
