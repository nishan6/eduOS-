import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "bg-surface-muted text-muted-foreground",
      primary: "bg-primary-soft text-primary",
      success: "bg-success-soft text-success",
      warning: "bg-warning-soft text-warning",
      danger: "bg-danger-soft text-danger",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

const STATUS_TONES: Record<string, VariantProps<typeof badge>["tone"]> = {
  PRESENT: "success", ABSENT: "danger", LATE: "warning", EXCUSED: "neutral",
  SUBMITTED: "success", DRAFT: "warning", NOT_STARTED: "neutral",
  PAID: "success", PARTIALLY_PAID: "warning", ISSUED: "primary", VOID: "neutral",
  RECORDED: "success", REVERSED: "danger", VERIFIED: "success", UNVERIFIED: "neutral", DISCREPANCY: "danger",
  ACTIVE: "success", SUSPENDED: "danger", INACTIVE: "neutral", WITHDRAWN: "neutral", ALUMNI: "neutral",
  PENDING: "warning", APPROVED: "success", REJECTED: "danger",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const text = label ?? status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{text}</Badge>;
}
