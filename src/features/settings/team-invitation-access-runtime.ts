import { createHash } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type Row = Record<string, unknown>;

export interface TeamInvitationAccess {
  id: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  email: string;
  role: "OWNER" | "DISPATCHER" | "CREW";
  state: "PENDING" | "ACCEPTED";
  expiresAt: string;
}

export type TeamInvitationLoadResult =
  | { ok: true; value: TeamInvitationAccess }
  | { ok: false; kind: "configuration" | "authentication" | "authorization" | "not_found" | "server"; message: string };

export type TeamInvitationAcceptResult =
  | { ok: true; message: string; workspaceSlug: string; role: "OWNER" | "DISPATCHER" | "CREW" }
  | { ok: false; message: string };

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && anonKey && serviceRoleKey ? { url, anonKey, serviceRoleKey } : undefined;
}

function validToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function sessionContext(): Promise<
  | { ok: true; userId: string; service: SupabaseClient }
  | { ok: false; kind: "configuration" | "authentication" | "server"; message: string }
> {
  const resolved = config();
  if (!resolved) {
    return { ok: false, kind: "configuration", message: "Team invitation access is temporarily unavailable." };
  }

  const cookieStore = await cookies();
  const auth = createServerClient(resolved.url, resolved.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Session refresh remains owned by the application auth layer.
      },
    },
  });

  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) {
    return { ok: false, kind: "authentication", message: "Sign in with the email address that received this invitation." };
  }

  const service = createClient(resolved.url, resolved.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { ok: true, userId: data.user.id, service };
}

function row(value: unknown): Row | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : undefined;
}

function mapInvitation(value: unknown): TeamInvitationAccess | undefined {
  const source = row(value);
  if (!source) return undefined;
  const role = source.role;
  const state = source.state;
  if (
    typeof source.id !== "string" ||
    typeof source.workspaceId !== "string" ||
    typeof source.workspaceSlug !== "string" ||
    typeof source.workspaceName !== "string" ||
    typeof source.email !== "string" ||
    (role !== "OWNER" && role !== "DISPATCHER" && role !== "CREW") ||
    (state !== "PENDING" && state !== "ACCEPTED") ||
    typeof source.expiresAt !== "string"
  ) return undefined;

  return {
    id: source.id,
    workspaceId: source.workspaceId,
    workspaceSlug: source.workspaceSlug,
    workspaceName: source.workspaceName,
    email: source.email,
    role,
    state,
    expiresAt: source.expiresAt,
  };
}

function readFailure(code: string): Exclude<TeamInvitationLoadResult, { ok: true }> {
  if (code === "INVITATION_EMAIL_MISMATCH") {
    return { ok: false, kind: "authorization", message: "This invitation belongs to a different email address." };
  }
  if (code === "INVITATION_EXPIRED") {
    return { ok: false, kind: "not_found", message: "This invitation has expired. Ask the workspace owner for a new link." };
  }
  if (code === "INVITATION_REVOKED") {
    return { ok: false, kind: "not_found", message: "This invitation has been revoked." };
  }
  if (code === "INVITATION_NOT_FOUND" || code === "INVITATION_INPUT_INVALID") {
    return { ok: false, kind: "not_found", message: "This invitation link is not valid." };
  }
  return { ok: false, kind: "server", message: "The invitation could not be loaded. Try again shortly." };
}

export async function loadTeamInvitation(token: string): Promise<TeamInvitationLoadResult> {
  const normalized = token.trim();
  if (!validToken(normalized)) return readFailure("INVITATION_INPUT_INVALID");

  const context = await sessionContext();
  if (!context.ok) return context;

  const { data, error } = await context.service.rpc("servicedesk_read_team_invitation", {
    p_input: {
      actorUserId: context.userId,
      tokenHash: tokenHash(normalized),
      now: new Date().toISOString(),
    },
  });
  if (error) return { ok: false, kind: "server", message: "The invitation could not be loaded. Try again shortly." };

  const payload = row(data);
  if (!payload || payload.ok !== true) return readFailure(typeof payload?.code === "string" ? payload.code : "INVITATION_READ_FAILED");
  const invitation = mapInvitation(payload.invitation);
  if (!invitation) return { ok: false, kind: "server", message: "The invitation response was incomplete." };
  return { ok: true, value: invitation };
}

export async function acceptTeamInvitation(token: string): Promise<TeamInvitationAcceptResult> {
  const normalized = token.trim();
  if (!validToken(normalized)) return { ok: false, message: "This invitation link is not valid." };

  const context = await sessionContext();
  if (!context.ok) return { ok: false, message: context.message };

  const { data, error } = await context.service.rpc("servicedesk_accept_team_invitation", {
    p_input: {
      actorUserId: context.userId,
      tokenHash: tokenHash(normalized),
      now: new Date().toISOString(),
    },
  });
  if (error) return { ok: false, message: "The invitation could not be accepted. Try again." };

  const payload = row(data);
  if (!payload || payload.ok !== true) {
    const code = typeof payload?.code === "string" ? payload.code : "";
    if (code === "INVITATION_EMAIL_UNVERIFIED") return { ok: false, message: "Confirm your account email before accepting this invitation." };
    if (code === "INVITATION_EMAIL_MISMATCH") return { ok: false, message: "Sign in with the email address that received this invitation." };
    if (code === "INVITATION_EXPIRED") return { ok: false, message: "This invitation has expired. Ask the workspace owner for a new link." };
    if (code === "INVITATION_REVOKED") return { ok: false, message: "This invitation has been revoked." };
    if (code === "INVITATION_NOT_FOUND" || code === "INVITATION_INPUT_INVALID") return { ok: false, message: "This invitation link is not valid." };
    return { ok: false, message: "The invitation could not be accepted. Try again." };
  }

  const role = payload.role;
  if (typeof payload.workspaceSlug !== "string" || (role !== "OWNER" && role !== "DISPATCHER" && role !== "CREW")) {
    return { ok: false, message: "The invitation response was incomplete." };
  }

  return {
    ok: true,
    message: "Invitation accepted. Your workspace access is ready.",
    workspaceSlug: payload.workspaceSlug,
    role,
  };
}
