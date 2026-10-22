import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}
export function THead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground" {...props} />;
}
export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("px-4 py-2.5 font-medium", className)} {...props} />;
}
export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-border last:border-0 hover:bg-surface-muted/60", className)} {...props} />;
}
export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-2.5 align-middle", className)} {...props} />;
}
