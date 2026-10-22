import { GraduationCap } from "lucide-react";

export function AuthShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><GraduationCap className="size-5" aria-hidden /></div>
          <span className="text-lg font-semibold tracking-tight">EduOS</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
