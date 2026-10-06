import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 team invitation product", () => {
  it("wires the owner invitation manager into the real Settings team section", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain('import { TeamInvitationManager }');
    expect(route).toContain('id="team"');
    expect(route).toContain('data.actor.role === "OWNER"');
    expect(route).toContain("<TeamInvitationManager");
    expect(route).toContain("workspaceSlug={workspaceSlug}");
    expect(route).toContain("invitations={snapshot.invitations}");
  });

  it("creates and revokes invitations through owner-scoped server actions", () => {
    const manager = source("src/features/settings/TeamInvitationManager.tsx");
    const actions = source("src/features/settings/team-invitation-actions.ts");
    const runtime = source("src/features/operations/operational-product-runtime.ts");
    expect(manager).toContain("Invite team member");
    expect(manager).toContain("Copy invite link");
    expect(manager).toContain("Provider email delivery is not implied");
    expect(actions).toContain("createOperationalTeamInvitation");
    expect(actions).toContain("revokeOperationalTeamInvitation");
    expect(runtime).toContain("Only workspace owners can invite team members");
    expect(runtime).toContain("Only workspace owners can revoke team invitations");
    expect(runtime).toContain('invitePath: "/auth/invitations/"');
  });

  it("provides a session-aware acceptance route without pretending signup exists", () => {
    const page = source("src/app/auth/invitations/[token]/page.tsx");
    const action = source("src/app/auth/invitations/[token]/actions.ts");
    expect(page).toContain("Sign in to continue");
    expect(page).toContain('/auth/sign-in?next=');
    expect(page).toContain("New account creation is not available from team invitations yet");
    expect(page).toContain("Accept invitation");
    expect(page).toContain("confirmed email matches the invitation");
    expect(action).toContain("acceptTeamInvitation");
    expect(action).toContain('result.role === "CREW"');
    expect(action).toContain('"/crew/today"');
    expect(action).toContain('"/app/" + encodeURIComponent(result.workspaceSlug) + "/overview"');
    expect(page).not.toContain("signUp(");
  });

  it("hashes bearer tokens server-side and revalidates the signed-in user through service-role RPCs", () => {
    const runtime = source("src/features/settings/team-invitation-access-runtime.ts");
    expect(runtime).toContain('createHash("sha256")');
    expect(runtime).toContain("auth.auth.getUser()");
    expect(runtime).toContain('rpc("servicedesk_read_team_invitation"');
    expect(runtime).toContain('rpc("servicedesk_accept_team_invitation"');
    expect(runtime).toContain("INVITATION_EMAIL_MISMATCH");
    expect(runtime).toContain("INVITATION_EMAIL_UNVERIFIED");
    expect(runtime).not.toContain("signUp(");
  });

  it("keeps invitation emails/expiry in owner presentation while omitting token material", () => {
    const contracts = source("src/contracts/dtos.ts");
    const mapper = source("src/server/core/reporting-platform-postgres.ts");
    expect(contracts).toContain("email?: string");
    expect(contracts).toContain("expiresAt?: ISODateTime");
    expect(mapper).toContain("email: maybeString(invitation.email)");
    expect(mapper).toContain("expiresAt: maybeString(invitation.expiresAt)");
    expect(mapper).not.toContain("tokenHash");
  });
});
