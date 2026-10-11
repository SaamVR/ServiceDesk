import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { operationalDatabaseMode } from "@/features/auth/operational-preview-mode";
import { ownerAfterLoginHref } from "@/features/auth/verified-owner-workspace";

const qa = {
  SERVICEDESK_OPERATIONS_RLS_PREVIEW_ENABLED: "true",
  SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED: "true",
  SERVICEDESK_OWNER_REGISTRATION_ENABLED: "false",
};

describe("staging-only authenticated RLS operations mode", () => {
  it("stays disabled with no admin key or without all QA guard switches", () => {
    expect(operationalDatabaseMode({})).toBe("DISABLED");
    expect(operationalDatabaseMode({ SERVICEDESK_OPERATIONS_RLS_PREVIEW_ENABLED:"true" })).toBe("DISABLED");
    expect(operationalDatabaseMode({ ...qa, SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED:"false" })).toBe("DISABLED");
    expect(operationalDatabaseMode({ ...qa, SERVICEDESK_OWNER_REGISTRATION_ENABLED:"true" })).toBe("DISABLED");
    expect(operationalDatabaseMode({ ...qa, SERVICEDESK_OPERATIONS_RLS_PREVIEW_ENABLED:"TRUE" })).toBe("DISABLED");
  });

  it("prefers explicitly configured operational service role", () => {
    expect(operationalDatabaseMode({ SUPABASE_SERVICE_ROLE_KEY: "server-placeholder" })).toBe("SERVICE_ROLE");
    expect(operationalDatabaseMode({ ...qa, SUPABASE_SERVICE_ROLE_KEY: "server-placeholder" })).toBe("SERVICE_ROLE");
    expect(operationalDatabaseMode({ SUPABASE_SERVICE_ROLE_KEY: "  " })).toBe("DISABLED");
  });

  it("opts into real RLS-backed operations only for isolated QA", () => {
    expect(operationalDatabaseMode(qa)).toBe("QA_SESSION_RLS");
    const workspace = { slug:"brightroom-cleaning",role:"OWNER",href:"/app/brightroom-cleaning/overview" };
    expect(ownerAfterLoginHref(workspace,qa)).toBe(workspace.href);
    expect(ownerAfterLoginHref(workspace,{})).toBe("/onboarding/verified?workspace=brightroom-cleaning");
    expect(ownerAfterLoginHref({ ...workspace,role:"DISPATCHER" },{})).toBe(workspace.href);
  });

  it("uses verified user session for QA queries, never anonymous or metadata roles", () => {
    const source=readFileSync(join(process.cwd(),"src/features/operations/operational-product-runtime.ts"),"utf8");
    expect(source).toContain('const { data: authData, error: authError } = await auth.auth.getUser();');
    expect(source).toContain('if (authError || !authData.user)');
    expect(source).toContain('config.mode === "SERVICE_ROLE" && config.serviceRoleKey');
    expect(source).toContain(': auth;');
    expect(source).toContain('.eq("user_id", authData.user.id)');
    expect(source).toContain('membership.status !== "ACTIVE"');
    expect(source).toContain('membership.role !== "OWNER" && membership.role !== "DISPATCHER"');
    expect(source).not.toContain("user_metadata");
  });

  it("discloses preview limitations on the verified owner welcome", () => {
    const page=readFileSync(join(process.cwd(),"src/app/onboarding/verified/page.tsx"),"utf8");
    expect(page).toContain('operationalMode === "QA_SESSION_RLS"');
    expect(page).toContain("Provider connectivity and all operational actions are not yet certified");
    expect(page).toContain('operationalConnected = operationalMode !== "DISABLED"');
    expect(page).toContain("loadVerifiedOwnerWorkspace(auth, data.user.id, workspaceSlug)");
  });
});
