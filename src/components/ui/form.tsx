import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(field, "h-10", className)} {...props} />
));
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(field, "h-10 pr-8", className)} {...props} />
));
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(field, "min-h-20 py-2", className)} {...props} />
));
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-foreground", className)} {...props} />;
}

/** Label + control + error message. `name` doubles as the htmlFor id and the error key. */
export function Field({
  label, name, error, hint, children, className,
}: { label: string; name: string; error?: string[]; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error?.length ? (
        <p id={`${name}-error`} className="text-xs text-danger" role="alert">{error[0]}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
