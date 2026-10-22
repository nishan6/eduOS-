import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "./reset-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Choose a new password">
      <ResetForm token={token ?? ""} />
    </AuthShell>
  );
}
