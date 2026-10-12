import type { Result } from "@/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveStaffActor } from "@/features/operations/operational-product-runtime";
import { operationalDatabaseMode } from "@/features/auth/operational-preview-mode";
import {
  verifyOwnerQuoteAutomationPrerequisites,
  type QuoteAutomationActivationProof,
} from "./owner-quote-automation-prerequisites";

export const QUOTE_ACCEPTED_INTERNAL_FEATURE_KEY = "AUTO_INTERNAL_QUOTE_ACCEPTED";
type Resolver = typeof resolveStaffActor;

export interface WorkspaceQuoteAutomationSetting {
  enabled: boolean;
  version: number;
  deploymentEnabled: boolean;
}
export interface OwnerQuoteAutomationDependencies {
  resolveActor?: Resolver;
  mode?: typeof operationalDatabaseMode;
  verifyPrerequisites?: (
    service: Pick<SupabaseClient, "from">, workspaceId: string,
  ) => Promise<QuoteAutomationActivationProof>;
}
const uuid = (value: unknown): value is string => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function fail(code: string, message: string): Result<never> {
  return { ok: false, code, message };
}

async function verifiedOwner(workspaceSlug: string, deps: OwnerQuoteAutomationDependencies) {
  if ((deps.mode ?? operationalDatabaseMode)() !== "SERVICE_ROLE") {
    return fail("AUTO_QUOTE_BACKEND_UNAVAILABLE", "The protected workflow settings backend is not available.");
  }
  try {
    const verified = await (deps.resolveActor ?? resolveStaffActor)(workspaceSlug);
    if (!verified.ok) return fail("AUTO_QUOTE_OWNER_UNVERIFIED", "A verified workspace owner is required.");
    const { actor, workspace } = verified.value;
    if (!uuid(workspace.id) || !uuid(actor.userId) ||
        workspace.slug !== workspaceSlug || actor.workspaceId !== workspace.id ||
        actor.role !== "OWNER") {
      return fail("AUTO_QUOTE_OWNER_REQUIRED", "Only an active owner can change automatic workflow settings.");
    }
    return { ok: true as const, value: verified.value };
  } catch {
    return fail("AUTO_QUOTE_AUTH_UNAVAILABLE", "Owner authorization could not be verified.");
  }
}

function deploymentEnabled() {
  return process.env.SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED === "true";
}

/** Read the existing scoped flag. Missing means OFF, not implicitly enabled. */
export async function readOwnerQuoteAutomationSetting(
  workspaceSlug: string,
  deps: OwnerQuoteAutomationDependencies = {},
): Promise<Result<WorkspaceQuoteAutomationSetting>> {
  const trusted = await verifiedOwner(workspaceSlug, deps);
  if (!trusted.ok) return trusted;
  const { workspace, service } = trusted.value;
  try {
  const read = await service.from("workspace_feature_flags")
    .select("enabled,version")
    .eq("workspace_id", workspace.id)
    .eq("feature_key", QUOTE_ACCEPTED_INTERNAL_FEATURE_KEY).maybeSingle();
  if (read.error) return fail("AUTO_QUOTE_FLAG_READ_UNAVAILABLE", "The saved workspace switch could not be verified.");
  if (!read.data) return { ok: true, value: { enabled: false, version: 0, deploymentEnabled: deploymentEnabled() } };
  if (typeof read.data.enabled !== "boolean" ||
      !Number.isSafeInteger(read.data.version) || read.data.version < 1) {
    return fail("AUTO_QUOTE_FLAG_INVALID", "The saved workspace switch is invalid.");
  }
  return { ok: true, value: {
    enabled: read.data.enabled, version: read.data.version,
    deploymentEnabled: deploymentEnabled(),
  }};
  } catch {
    return fail("AUTO_QUOTE_FLAG_READ_UNAVAILABLE", "The workspace switch could not be verified.");
  }
}

/**
 * Deliberate owner-only update, with expected-version optimistic concurrency.
 * Never trusts caller-selected tenant ID, role or actor user ID. No provider
 * messages, payments, AI calls, or workflow execution occur here.
 */
export async function setOwnerQuoteAutomationSetting(
  workspaceSlug: string,
  enabled: boolean,
  expectedVersion: number,
  deps: OwnerQuoteAutomationDependencies = {},
): Promise<Result<WorkspaceQuoteAutomationSetting>> {
  if (typeof enabled !== "boolean" || !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 0 || expectedVersion > Number.MAX_SAFE_INTEGER - 1) {
    return fail("AUTO_QUOTE_INVALID_INPUT", "Submit a valid settings change.");
  }
  const trusted = await verifiedOwner(workspaceSlug, deps);
  if (!trusted.ok) return trusted;
  const { actor, workspace, service } = trusted.value;
  try {
  const flags = service.from("workspace_feature_flags");
  const previous = await flags.select("enabled,version")
    .eq("workspace_id", workspace.id)
    .eq("feature_key", QUOTE_ACCEPTED_INTERNAL_FEATURE_KEY).maybeSingle();
  if (previous.error) return fail("AUTO_QUOTE_FLAG_READ_UNAVAILABLE", "Existing workspace settings could not be verified.");
  const savedVersion = previous.data?.version;
  if (previous.data && (!Number.isSafeInteger(savedVersion) || savedVersion < 1)) {
    return fail("AUTO_QUOTE_FLAG_INVALID", "The existing settings version is invalid.");
  }
  if ((savedVersion ?? 0) !== expectedVersion) {
    return fail("AUTO_QUOTE_VERSION_CONFLICT", "The settings changed in another session. Reload before retrying.");
  }
  // A tenant with no real cleaning catalog/rates/published internal rule
  // cannot arm a no-op automatic trigger. Disabling ALWAYS stays available,
  // even if providers, pricing or rule reads fail.
  if (enabled && previous.data?.enabled !== true) {
    const check = await (deps.verifyPrerequisites ?? verifyOwnerQuoteAutomationPrerequisites)(
      service, workspace.id,
    );
    if (!check.ok) {
      const messages: Record<typeof check.code, string> = {
        AUTO_QUOTE_SERVICE_MISSING: "Configure an active cleaning service in Settings before opting in.",
        AUTO_QUOTE_PRICING_MISSING: "Add an actual active USD branch price book before opting in.",
        AUTO_QUOTE_INTERNAL_RULE_MISSING: "Publish a QUOTE_ACCEPTED internal attention rule for a priced branch first.",
        AUTO_QUOTE_PREREQUISITES_UNVERIFIED: "Saved service, pricing and rule readiness could not be verified. No automation setting was changed.",
      };
      return fail(check.code, messages[check.code]);
    }
  }
  const payload = { enabled, updated_by: actor.userId, version: expectedVersion + 1 };
  const write = !previous.data
    ? await service.from("workspace_feature_flags")
      .insert({ workspace_id: workspace.id, feature_key: QUOTE_ACCEPTED_INTERNAL_FEATURE_KEY,
        config: {}, ...payload }).select("enabled,version").maybeSingle()
    : await service.from("workspace_feature_flags")
      .update(payload)
      .eq("workspace_id", workspace.id).eq("feature_key", QUOTE_ACCEPTED_INTERNAL_FEATURE_KEY)
      .eq("version", expectedVersion).select("enabled,version").maybeSingle();
  if (write.error || write.data?.enabled !== enabled || write.data?.version !== expectedVersion + 1) {
    return fail("AUTO_QUOTE_WRITE_NOT_VERIFIED", "The workspace switch was not confirmed. Reload before retrying.");
  }

  // Never claim success from an unverified write response alone.
  const proof = await service.from("workspace_feature_flags")
    .select("enabled,version,updated_by")
    .eq("workspace_id", workspace.id)
    .eq("feature_key", QUOTE_ACCEPTED_INTERNAL_FEATURE_KEY).maybeSingle();
  if (proof.error || proof.data?.enabled !== enabled ||
      proof.data.version !== expectedVersion + 1 ||
      proof.data.updated_by !== actor.userId) {
    return fail("AUTO_QUOTE_READBACK_UNVERIFIED", "The workspace switch could not be read back.");
  }
  return { ok: true, value: {
    enabled, version: expectedVersion + 1, deploymentEnabled: deploymentEnabled(),
  }};
  } catch {
    return fail("AUTO_QUOTE_WRITE_NOT_VERIFIED", "The settings connection could not be verified.");
  }
}

/** The customer event may only trigger for an explicitly opted-in tenant. */
export async function workspaceQuoteAutomationEnabled(
  service: Pick<SupabaseClient, "from">, workspaceId: string,
): Promise<boolean> {
  if (!uuid(workspaceId)) return false;
  try {
    const read = await service.from("workspace_feature_flags")
      .select("enabled")
      .eq("workspace_id", workspaceId)
      .eq("feature_key", QUOTE_ACCEPTED_INTERNAL_FEATURE_KEY).maybeSingle();
    return !read.error && read.data?.enabled === true;
  } catch {
    return false;
  }
}
