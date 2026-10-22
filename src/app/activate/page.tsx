import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui/misc";
import { getInvitationByToken } from "@/modules/identity/service";
import { ActivateForm } from "./activate-form";

export const metadata: Metadata = { title: "Activate account" };

export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const invitation = token ? await getInvitationByToken(token) : null;
  return (
    <AuthShell title="Activate your EduOS account" description={invitation ? `Welcome, ${invitation.name}. Choose a password for ${invitation.email}.` : undefined}>
      {invitation ? (
        <>
          {invitation.existingUser && (
            <Alert tone="info" className="mb-4">You already have an EduOS login. Accepting adds this access to it; your existing password stays the same.</Alert>
          )}
          <ActivateForm token={token} />
        </>
      ) : (
        <Alert tone="danger" title="Invitation not valid">This link is invalid, already used or expired. Ask your school to send a new invitation.</Alert>
      )}
    </AuthShell>
  );
}
