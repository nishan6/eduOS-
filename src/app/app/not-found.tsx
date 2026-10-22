import Link from "next/link";
import { SearchX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

export default function AppNotFound() {
  return (
    <Card>
      <EmptyState icon={SearchX} title="Not found" description="This page does not exist or you do not have access to it."
        action={<Link href="/app" className="mt-2 text-sm text-primary hover:underline">Go to your home page</Link>} />
    </Card>
  );
}
