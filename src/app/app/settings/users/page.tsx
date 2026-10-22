import { requireSchoolPage } from "@/server/context";
import { canSchoolWide } from "@/lib/permissions/evaluate";
import { listSchoolUsers } from "@/modules/identity/service";
import { formatDateTime } from "@/lib/dates";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { InviteStaffForm, MembershipToggle } from "./user-forms";

export const metadata = { title: "Users & roles" };

export default async function UsersPage() {
  const { actor, school } = await requireSchoolPage("users.read");
  const data = await listSchoolUsers(actor, school.id);
  const canManage = canSchoolWide(actor, "users.manage", school.id);
  return (
    <>
      <PageHeader title="Users & roles" description={`Staff with access to ${school.name}. There is no public sign-up: staff join by invitation.`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>School staff</CardTitle></CardHeader>
            <CardContent className="px-0">
              <Table>
                <THead><tr><TH>Name</TH><TH>Roles</TH><TH>Access</TH>{canManage && <TH />}</tr></THead>
                <tbody>{data.members.map((m) => (
                  <TR key={m.id}>
                    <TD><p className="font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.email}</p></TD>
                    <TD><div className="flex flex-wrap gap-1">{m.roles.map((r) => <Badge key={r}>{r}</Badge>)}</div></TD>
                    <TD><StatusBadge status={m.membershipStatus} /></TD>
                    {canManage && <TD className="text-right">{m.id !== actor.userId && <MembershipToggle schoolId={school.id} userId={m.id} status={m.membershipStatus} />}</TD>}
                  </TR>
                ))}</tbody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div><CardTitle>Organization-wide access</CardTitle><CardDescription>These users can access every school in the group.</CardDescription></div></CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">{data.orgWide.map((u) => <li key={u.id + u.role}>{u.name} <span className="text-muted-foreground">· {u.role}</span></li>)}</ul>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          {canManage && <Card><CardHeader><div><CardTitle>Invite staff</CardTitle><CardDescription>You can only grant roles whose permissions you hold.</CardDescription></div></CardHeader><CardContent><InviteStaffForm schoolId={school.id} roles={data.roles.map((r) => ({ key: r.key, name: r.name }))} /></CardContent></Card>}
          <Card>
            <CardHeader><CardTitle>Pending invitations</CardTitle></CardHeader>
            <CardContent>
              {data.invitations.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
                <ul className="space-y-1.5 text-sm">{data.invitations.map((i) => <li key={i.id}>{i.name} <span className="text-muted-foreground">· {i.email} · expires {formatDateTime(i.expiresAt)}</span></li>)}</ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
