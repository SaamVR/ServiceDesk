"use server";

import { redirect } from "next/navigation";
import {
  createOperationalTeamInvitation,
  revokeOperationalTeamInvitation,
  type OperationalInvitationActionResult,
} from "@/features/operations/operational-product-runtime";

export type TeamInvitationFormState = OperationalInvitationActionResult;

export async function createTeamInvitationAction(
  _previous: TeamInvitationFormState,
  formData: FormData,
): Promise<TeamInvitationFormState> {
  const workspaceSlug = String(formData.get("workspaceSlug") ?? "");
  const email = String(formData.get("email") ?? "");
  const rawRole = String(formData.get("role") ?? "");
  const role =
    rawRole === "OWNER" || rawRole === "DISPATCHER" || rawRole === "CREW"
      ? rawRole
      : undefined;

  if (!workspaceSlug || !role) {
    return { ok: false, message: "Check the invitation details and try again." };
  }

  return createOperationalTeamInvitation(workspaceSlug, { email, role });
}

export async function revokeTeamInvitationAction(formData: FormData): Promise<never> {
  const workspaceSlug = String(formData.get("workspaceSlug") ?? "");
  const invitationId = String(formData.get("invitationId") ?? "");
  const result = await revokeOperationalTeamInvitation(workspaceSlug, invitationId);
  const key = result.ok ? "notice" : "error";
  redirect(
    "/app/" +
      encodeURIComponent(workspaceSlug) +
      "/settings?" +
      key +
      "=" +
      encodeURIComponent(result.message) +
      "#team",
  );
}
