import { describe, expect, it } from "vitest";
import { createSchool, organizationOverview } from "@/modules/org/service";
import { prisma } from "@/lib/db";
import { actor, school, T } from "../support/actors";

describe("organization administration", () => {
  it("owner creates a school with a current year and chart of accounts; others cannot", async () => {
    const owner = await actor(T.owner);
    const sps = await school("SPS");
    const input = { organizationId: sps.organizationId, name: "Sunrise Junior (Test)", code: "SJT", board: "CBSE" as const, academicYear: { name: "2026-27", startDate: "2026-06-01", endDate: "2027-04-30" } };
    await expect(createSchool(await actor(T.principalSps), input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const created = await createSchool(owner, input);
    expect(await prisma.ledgerAccount.count({ where: { schoolId: created.id } })).toBe(7);
    await expect(createSchool(owner, input)).rejects.toMatchObject({ code: "CONFLICT" });
    const overview = await organizationOverview(await actor(T.owner), sps.organizationId);
    expect(overview.map((r) => r.school.code).sort()).toEqual(["SJT", "SPS", "SVL"]);
    await expect(organizationOverview(await actor(T.principalSps), sps.organizationId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
