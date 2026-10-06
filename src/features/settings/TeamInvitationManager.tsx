"use client";

import { useActionState, useState } from "react";
import type { TeamInvitationDTO } from "@/contracts";
import {
  createTeamInvitationAction,
  revokeTeamInvitationAction,
  type TeamInvitationFormState,
} from "./team-invitation-actions";
import styles from "./TeamInvitationManager.module.css";

const initialState: TeamInvitationFormState = {
  ok: false,
  message: "",
};

function formatInviteDate(value: string | undefined, timeZone: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

export function TeamInvitationManager({
  workspaceSlug,
  timeZone,
  invitations,
}: {
  workspaceSlug: string;
  timeZone: string;
  invitations: TeamInvitationDTO[];
}) {
  const [state, formAction, pending] = useActionState(createTeamInvitationAction, initialState);
  const [copied, setCopied] = useState(false);

  async function copyInviteLink() {
    if (!state.ok || !state.invitePath) return;
    const absolute = window.location.origin + state.invitePath;
    await navigator.clipboard.writeText(absolute);
    setCopied(true);
  }

  return (
    <div className={styles.manager}>
      <form action={formAction} className={styles.inviteForm}>
        <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
        <label>
          <span>Email</span>
          <input
            className="app-input"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            placeholder="name@company.com"
            required
          />
        </label>
        <label>
          <span>Role</span>
          <select className="app-select" name="role" defaultValue="CREW">
            <option value="CREW">Crew</option>
            <option value="DISPATCHER">Dispatcher</option>
            <option value="OWNER">Owner</option>
          </select>
        </label>
        <button className="app-button-primary" type="submit" disabled={pending}>
          {pending ? "Creating…" : "Invite team member"}
        </button>
      </form>

      {state.message ? (
        <div className={state.ok ? styles.success : styles.error} role={state.ok ? "status" : "alert"}>
          <strong>{state.ok ? "Invitation ready" : "Invitation not created"}</strong>
          <p>{state.message}</p>
          {state.ok && state.invitePath ? (
            <div className={styles.inviteLinkActions}>
              <button className="app-button-secondary" type="button" onClick={copyInviteLink}>
                {copied ? "Copied" : "Copy invite link"}
              </button>
              <code>{state.invitePath}</code>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.invitationList}>
        {invitations.length === 0 ? (
          <div className={styles.empty}>
            <strong>No invitations</strong>
            <p>Create an invitation when a team member is ready to join this workspace.</p>
          </div>
        ) : (
          invitations.map((invite) => (
            <article className={styles.invitationRow} key={invite.id}>
              <span className={styles.inviteMark} aria-hidden="true">+</span>
              <span className={styles.inviteCopy}>
                <strong>{invite.email ?? "Invited team member"}</strong>
                <small>
                  {invite.role.toLowerCase()} · Created {formatInviteDate(invite.createdAt, timeZone)}
                  {invite.expiresAt ? " · Expires " + formatInviteDate(invite.expiresAt, timeZone) : ""}
                </small>
              </span>
              <span className={styles.state + " " + styles["state_" + invite.state.toLowerCase()]}>
                {invite.state.toLowerCase()}
              </span>
              {invite.state === "PENDING" ? (
                <form action={revokeTeamInvitationAction}>
                  <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                  <input type="hidden" name="invitationId" value={invite.id} />
                  <button className="app-button-secondary" type="submit">Revoke</button>
                </form>
              ) : null}
            </article>
          ))
        )}
      </div>

      <p className={styles.help}>
        Invite links are displayed only when issued. ServiceDesk stores only a token hash; share the link securely.
        Provider email delivery is not implied by creating an invitation.
      </p>
    </div>
  );
}
