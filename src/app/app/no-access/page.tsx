import { ShieldOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

export default function NoAccess() {
  return (
    <Card>
      <EmptyState icon={ShieldOff} title="No access assigned yet" description="Your account is active but has no school role or linked children. Contact your school administrator." />
    </Card>
  );
}
