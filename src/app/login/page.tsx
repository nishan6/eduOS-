import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; reset?: string }> }) {
  const sp = await searchParams;
  if (sp.error !== "inactive" && (await getSession())) redirect("/app");
  const notice = sp.error === "inactive" ? "Your account is not active. Contact your school administrator." : sp.reset ? "Password updated. Sign in with your new password." : undefined;
  return (
    <AuthShell title="Sign in to EduOS" description="Use the account your school created for you.">
      <LoginForm next={sp.next} notice={notice} />
      {process.env.EDUOS_ENV !== "production" && (
        <p className="mt-8 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          Development data: demo accounts are listed in <code>docs/RUNNING.md</code>.
        </p>
      )}
    </AuthShell>
  );
}
