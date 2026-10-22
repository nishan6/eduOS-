"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { switchSchoolAction } from "../actions";

export function SwitchSchoolLink({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="link" size="sm" disabled={pending} onClick={() => start(async () => { const r = await switchSchoolAction(schoolId); if (r.ok) router.push("/app/principal"); })}>
      Open school
    </Button>
  );
}
