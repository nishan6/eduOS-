import Link from "next/link";
import { notFound } from "next/navigation";
import { Bus, CalendarCheck, ChevronRight, IndianRupee, Sparkles, UsersRound } from "lucide-react";
import { requireActor } from "@/server/actor";
import { hasFamilyPermission } from "@/lib/permissions/evaluate";
import { getFamilyHome, type FamilyChild } from "@/modules/family/service";
import { formatPaise } from "@/lib/money";
import { formatDate, schoolToday } from "@/lib/dates";
import { formatRate } from "@/modules/attendance/calc";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export const metadata = { title: "My children" };

const BOARD: Record<string, string> = { CBSE: "CBSE", AP_STATE: "AP State Board", ICSE: "ICSE", IB: "IB", OTHER: "Other" };

function TodayLine({ child }: { child: FamilyChild }) {
  if (!child.today) return <p className="text-sm text-muted-foreground">Today&apos;s attendance has not been submitted yet.</p>;
  const map = { PRESENT: "is marked present today", LATE: "arrived late today", ABSENT: "is marked absent today", EXCUSED: "is on excused leave today" };
  return (
    <p className="flex items-center gap-2 text-sm">
      <StatusBadge status={child.today.status} />
      <span>{child.firstName} {map[child.today.status]}.</span>
    </p>
  );
}

function ChildCard({ child }: { child: FamilyChild }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{child.name}</h2>
          <p className="text-sm text-muted-foreground">{child.className ?? "Not enrolled this year"} · Adm. {child.admissionNo}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="primary">{child.school.name}</Badge>
            <Badge>{BOARD[child.school.board]}</Badge>
          </div>
        </div>
        <Link href={`/app/family/children/${child.id}`} className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
          Details <ChevronRight className="size-4" aria-hidden />
        </Link>
      </CardHeader>
      <CardContent className="space-y-4 border-t border-border">
        <TodayLine child={child} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-surface-muted p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><CalendarCheck className="size-3.5" aria-hidden /> Attendance, last 30 days</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatRate(child.attendance30.rate)}</p>
            <p className="text-xs text-muted-foreground">
              {child.attendance30.tally.total === 0 ? "No submitted attendance yet." : `${child.attendance30.tally.absent} absent, ${child.attendance30.tally.late} late of ${child.attendance30.tally.total} days`}
            </p>
          </div>
          <div className="rounded-lg bg-surface-muted p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><IndianRupee className="size-3.5" aria-hidden /> Fees</p>
            {child.fees === null ? (
              <p className="mt-1 text-sm text-muted-foreground">Fee details are handled by another guardian.</p>
            ) : child.fees.outstandingPaise === 0 ? (
              <><p className="mt-1 text-xl font-semibold text-success">No dues</p><p className="text-xs text-muted-foreground">All issued invoices are paid.</p></>
            ) : (
              <>
                <p className={`mt-1 text-xl font-semibold tabular-nums ${child.fees.overduePaise > 0 ? "text-danger" : ""}`}>{formatPaise(child.fees.outstandingPaise)}</p>
                <p className="text-xs text-muted-foreground">
                  {child.fees.overduePaise > 0 ? `${formatPaise(child.fees.overduePaise)} overdue. ` : ""}
                  {child.fees.nextDue ? `Next due ${formatDate(child.fees.nextDue.dueDate)}` : ""}
                </p>
              </>
            )}
          </div>
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Bus className="size-3.5" aria-hidden /> Bus tracking is not available: the transport module is not set up for this school yet.</p>
      </CardContent>
    </Card>
  );
}

export default async function FamilyHome() {
  const actor = await requireActor();
  if (!hasFamilyPermission(actor, "family.read")) notFound();
  const children = await getFamilyHome(actor);
  const absentToday = children.filter((c) => c.today?.status === "ABSENT");
  const overdue = children.filter((c) => (c.fees?.overduePaise ?? 0) > 0);
  return (
    <>
      <PageHeader title={`Hello, ${actor.name.split(" ").slice(-1)[0]}`} description={`Here is how your ${children.length === 1 ? "child's" : "children's"} day looks · ${formatDate(schoolToday())}`} />
      {children.length === 0 ? (
        <Card><EmptyState icon={UsersRound} title="No children linked yet" description="Ask the school office to link your children to your account." /></Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" aria-hidden /> Needs your attention</CardTitle></CardHeader>
            <CardContent>
              {absentToday.length === 0 && overdue.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing urgent. Attendance and fees are up to date based on the records available.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {absentToday.map((c) => <li key={`a-${c.id}`}>{c.firstName} is marked absent today at {c.school.name}.</li>)}
                  {overdue.map((c) => <li key={`f-${c.id}`}>{c.firstName} has {formatPaise(c.fees!.overduePaise)} in overdue fees.</li>)}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">Built from attendance and fee records only. Homework, exams and the AI daily summary arrive in later releases.</p>
            </CardContent>
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">{children.map((c) => <ChildCard key={c.id} child={c} />)}</div>
        </div>
      )}
    </>
  );
}
