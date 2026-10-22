import { describe, expect, it } from "vitest";
import { can, canInOrganization, canSchoolWide, hasFamilyPermission, sectionFilter, scopesFor, type Actor, type Grant } from "@/lib/permissions/evaluate";
import { ROLE_TEMPLATES, PERMISSIONS } from "@/lib/permissions/catalog";

const ORG = "org1";
const OTHER_ORG = "org2";
const A = { id: "schoolA", organizationId: ORG, name: "A", code: "A", board: "CBSE" };
const B = { id: "schoolB", organizationId: ORG, name: "B", code: "B", board: "AP_STATE" };
const X = { id: "schoolX", organizationId: OTHER_ORG, name: "X", code: "X", board: "CBSE" };

function actorWith(roleKey: string, schoolId: string | null, extra: Partial<Actor> = {}): Actor {
  const t = ROLE_TEMPLATES.find((r) => r.key === roleKey)!;
  const grants: Grant[] = Object.entries(t.permissions).map(([permission, scope]) => ({
    permission: permission as Grant["permission"], scope: scope!, roleKey, organizationId: ORG, schoolId,
  }));
  return { userId: "u", name: "U", email: "u@x", grants, schools: [A, B], assignedSections: {}, guardianId: null, roleKeys: [roleKey], ...extra };
}

describe("permission evaluation", () => {
  it("teacher only marks attendance for assigned sections in their school", () => {
    const t = actorWith("teacher", A.id, { schools: [A], assignedSections: { [A.id]: ["s1"] } });
    expect(can(t, "attendance.mark", { schoolId: A.id, sectionId: "s1" })).toBe(true);
    expect(can(t, "attendance.mark", { schoolId: A.id, sectionId: "s2" })).toBe(false);
    expect(can(t, "attendance.mark", { schoolId: A.id })).toBe(false);
    expect(canSchoolWide(t, "attendance.mark", A.id)).toBe(false);
    expect(sectionFilter(t, "students.read", A.id)).toEqual(["s1"]);
  });

  it("school-scoped role does not leak to another school of the same organization", () => {
    const p = actorWith("principal", A.id, { schools: [A] });
    expect(can(p, "students.read", { schoolId: A.id })).toBe(true);
    expect(can(p, "students.read", { schoolId: B.id })).toBe(false);
  });

  it("organization-wide role applies to every school in its organization only", () => {
    const o = actorWith("org_owner", null, { schools: [A, B] });
    expect(can(o, "fees.read", { schoolId: A.id })).toBe(true);
    expect(can(o, "fees.read", { schoolId: B.id })).toBe(true);
    expect(canInOrganization(o, "reports.read", ORG)).toBe(true);
    // A school the actor is not authorized for is never granted, even with a matching grant.
    expect(can({ ...o, schools: [A, B] }, "fees.read", { schoolId: X.id })).toBe(false);
    expect(canInOrganization(o, "reports.read", OTHER_ORG)).toBe(false);
  });

  it("finance rule: only finance roles and owners can write the ledger", () => {
    const writers = ROLE_TEMPLATES.filter((r) => r.permissions["finance.ledger.create"]).map((r) => r.key).sort();
    expect(writers).toEqual(["accounts_admin", "org_owner"]);
    for (const role of ["teacher", "principal", "accountant", "group_admin", "school_management", "parent"]) {
      const a = actorWith(role, ROLE_TEMPLATES.find((r) => r.key === role)!.level === "organization" ? null : A.id);
      expect(can(a, "finance.ledger.create", { schoolId: A.id }), role).toBe(false);
    }
  });

  it("parent permissions are family-scoped and never school-wide", () => {
    const parent = actorWith("parent", null, { schools: [], guardianId: "g1" });
    expect(hasFamilyPermission(parent, "family.read")).toBe(true);
    expect(hasFamilyPermission({ ...parent, guardianId: null }, "family.read")).toBe(false);
    expect(can({ ...parent, schools: [A] }, "students.read", { schoolId: A.id })).toBe(false);
    expect(scopesFor({ ...parent, schools: [A] }, "students.read", A.id)).toEqual(["OWN_FAMILY"]);
  });

  it("every template only references catalogued permissions", () => {
    for (const t of ROLE_TEMPLATES) for (const k of Object.keys(t.permissions)) expect(PERMISSIONS).toHaveProperty(k);
  });

  it("academic permissions: teachers enter marks and homework only for assigned sections and cannot create exams", () => {
    const t = actorWith("teacher", A.id, { schools: [A], assignedSections: { [A.id]: ["s1"] } });
    expect(can(t, "marks.enter", { schoolId: A.id, sectionId: "s1" })).toBe(true);
    expect(can(t, "marks.enter", { schoolId: A.id, sectionId: "s2" })).toBe(false);
    expect(can(t, "homework.manage", { schoolId: A.id, sectionId: "s2" })).toBe(false);
    expect(canSchoolWide(t, "announcements.send", A.id)).toBe(false);
    expect(can(t, "exams.manage", { schoolId: A.id, sectionId: "s1" })).toBe(false);
    const p = actorWith("principal", A.id);
    expect(canSchoolWide(p, "exams.manage", A.id)).toBe(true);
    expect(canSchoolWide(p, "exams.manage", B.id)).toBe(false);
    const managers = ROLE_TEMPLATES.filter((r) => r.permissions["exams.manage"]).map((r) => r.key).sort();
    expect(managers).toEqual(["principal", "vice_principal"]);
  });

  it("admissions: cashier and teacher cannot see enquiries; front office can log them but not admit", () => {
    expect(canSchoolWide(actorWith("accountant", A.id), "admissions.read", A.id)).toBe(false);
    expect(can(actorWith("teacher", A.id, { assignedSections: { [A.id]: ["s1"] } }), "admissions.read", { schoolId: A.id, sectionId: "s1" })).toBe(false);
    const fo = actorWith("front_office", A.id);
    expect(canSchoolWide(fo, "admissions.manage", A.id)).toBe(true);
    expect(canSchoolWide(fo, "students.create", A.id)).toBe(false);
  });
});
