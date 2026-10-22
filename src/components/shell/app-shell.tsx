"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, BookOpenCheck, Building2, CalendarCheck, ClipboardList, GraduationCap, Home, Inbox, Landmark, LogOut,
  Menu, Receipt, School, Search, ShieldCheck, Users, UsersRound, X, type LucideIcon,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import type { NavIcon, NavItem } from "@/lib/navigation";
import { switchSchoolAction } from "@/app/app/actions";
import { signOutAction } from "@/app/login/actions";

const ICONS: Record<NavIcon, LucideIcon> = {
  home: Home, family: UsersRound, teacher: BookOpenCheck, principal: School, owner: Building2, students: GraduationCap,
  attendance: CalendarCheck, fees: Receipt, finance: Landmark, school: ClipboardList, users: Users, audit: ShieldCheck,
  outbox: Inbox, bell: Bell,
};

type Props = {
  nav: NavItem[];
  schools: { id: string; name: string; code: string }[];
  activeSchoolId: string | null;
  user: { name: string; email: string; roleLabel: string };
  unread: number;
  academicYear: string | null;
  canSearchStudents: boolean;
  children: React.ReactNode;
};

function NavLinks({ nav, onNavigate }: { nav: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = ["Home", "Operations", "Settings"] as const;
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {groups.map((g) => {
        const items = nav.filter((n) => n.group === g);
        if (!items.length) return null;
        return (
          <div key={g}>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g}</p>
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                        active ? "bg-primary-soft font-medium text-primary" : "text-foreground/80 hover:bg-surface-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SchoolSwitcher({ schools, activeSchoolId }: { schools: Props["schools"]; activeSchoolId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (schools.length === 0) return null;
  if (schools.length === 1) {
    return <p className="truncate text-sm font-medium" title={schools[0]!.name}>{schools[0]!.name}</p>;
  }
  return (
    <label className="block">
      <span className="sr-only">Current school</span>
      <select
        aria-label="Current school"
        className="h-9 w-full truncate rounded-lg border border-border bg-surface px-2 text-sm font-medium"
        value={activeSchoolId ?? ""}
        disabled={pending}
        onChange={(e) => start(async () => { await switchSchoolAction(e.target.value); router.refresh(); })}
      >
        {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </label>
  );
}

export function AppShell({ nav, schools, activeSchoolId, user, unread, academicYear, canSearchStudents, children }: Props) {
  const [open, setOpen] = useState(false);
  const sidebar = (
    <div className="flex h-full flex-col gap-6 px-3 py-4">
      <Link href="/app" className="flex items-center gap-2 px-2" onClick={() => setOpen(false)}>
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><GraduationCap className="size-4" aria-hidden /></div>
        <span className="font-semibold tracking-tight">EduOS</span>
      </Link>
      {schools.length > 0 && (
        <div className="px-1">
          <SchoolSwitcher schools={schools} activeSchoolId={activeSchoolId} />
          {academicYear && <p className="mt-1 px-1 text-xs text-muted-foreground">Academic year {academicYear}</p>}
        </div>
      )}
      <div className="flex-1 overflow-y-auto"><NavLinks nav={nav} onNavigate={() => setOpen(false)} /></div>
      <div className="flex items-center gap-2 border-t border-border px-1 pt-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold">{initials(user.name)}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.roleLabel}</p>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="rounded-lg p-2 text-muted-foreground hover:bg-surface-muted hover:text-foreground" aria-label="Sign out" title="Sign out">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-pop">
            <button className="absolute right-3 top-4 rounded-lg p-1.5 hover:bg-surface-muted" onClick={() => setOpen(false)} aria-label="Close navigation"><X className="size-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}

      <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur lg:px-8">
        <button className="-ml-1 rounded-lg p-1.5 hover:bg-surface-muted lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu className="size-5" /></button>
        {canSearchStudents ? (
          <form action="/app/students" className="relative max-w-md flex-1" role="search">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input name="q" placeholder="Search students by name or admission no." aria-label="Search students"
              className="h-9 w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 text-sm placeholder:text-muted-foreground" />
          </form>
        ) : <div className="flex-1" />}
        <div className="ml-auto flex items-center gap-1">
          <Link href="/app/notifications" className="relative rounded-lg p-2 hover:bg-surface-muted" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
            <Bell className="size-5" />
            {unread > 0 && <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
