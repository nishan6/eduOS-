"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card>
      <EmptyState icon={AlertTriangle} title="Something went wrong" description="The error has been logged. Try again, and contact support if it keeps happening."
        action={<Button variant="secondary" className="mt-2" onClick={reset}>Try again</Button>} />
    </Card>
  );
}
