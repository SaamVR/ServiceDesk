"use server";

import { redirect } from "next/navigation";
import { acceptTeamInvitation } from "@/features/settings/team-invitation-access-runtime";

export async function acceptTeamInvitationAction(formData: FormData): Promise<never> {
  const token = String(formData.get("token") ?? "");
  const result = await acceptTeamInvitation(token);
  if (!result.ok) {
    redirect(
      "/auth/invitations/" + encodeURIComponent(token) + "?error=" + encodeURIComponent(result.message),
    );
  }

  const destination = result.role === "CREW"
    ? "/crew/today"
    : "/app/" + encodeURIComponent(result.workspaceSlug) + "/overview";
  redirect(destination + "?notice=" + encodeURIComponent(result.message));
}
