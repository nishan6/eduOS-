import { redirect } from "next/navigation";
import { homeFor } from "@/lib/navigation";
import { getActiveSchool } from "@/lib/tenant/active-school";
import { requireActor } from "@/server/actor";

export default async function AppHome() {
  const actor = await requireActor();
  redirect(homeFor(actor, await getActiveSchool(actor)));
}
