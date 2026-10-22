"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { decideCorrectionAction } from "./actions";

export function DecisionButtons({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const decide = (approve: boolean) => start(async () => {
    const r = await decideCorrectionAction(requestId, approve);
    if (!r.ok) setError(r.message);
  });
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => decide(false)}>Reject</Button>
        <Button size="sm" disabled={pending} onClick={() => decide(true)}>Approve</Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
