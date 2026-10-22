import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({
  title, description, actions, breadcrumbs,
}: { title: string; description?: string; actions?: React.ReactNode; breadcrumbs?: { href: string; label: string }[] }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumbs?.length ? (
          <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((b, i) => (
              <span key={b.href} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden>/</span>}
                <Link href={b.href} className="hover:text-foreground">{b.label}</Link>
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="rounded-full bg-surface-muted p-3 text-muted-foreground"><Icon className="size-5" aria-hidden /></div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function Stat({ label, value, hint, tone, href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "danger" | "warning" | "success"; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums tracking-tight", tone === "danger" && "text-danger", tone === "warning" && "text-warning", tone === "success" && "text-success")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const cls = "block rounded-card border border-border bg-surface p-4 shadow-card";
  return href ? <Link href={href} className={cn(cls, "transition-colors hover:border-primary/40")}>{body}</Link> : <div className={cls}>{body}</div>;
}

const ALERT = {
  info: { icon: Info, cls: "bg-info-soft text-foreground" },
  success: { icon: CheckCircle2, cls: "bg-success-soft text-foreground" },
  warning: { icon: TriangleAlert, cls: "bg-warning-soft text-foreground" },
  danger: { icon: AlertCircle, cls: "bg-danger-soft text-foreground" },
};

export function Alert({ tone = "info", title, children, className }: { tone?: keyof typeof ALERT; title?: string; children?: React.ReactNode; className?: string }) {
  const { icon: Icon, cls } = ALERT[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg px-4 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-muted-foreground")}>{children}</div>}
      </div>
    </div>
  );
}

export function DevBadge({ children = "Development mode" }: { children?: React.ReactNode }) {
  return <span className="rounded border border-dashed border-warning px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">{children}</span>;
}
