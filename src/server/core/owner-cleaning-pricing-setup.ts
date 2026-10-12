import type { Result } from "../../contracts";
import { resolveStaffActor } from "@/features/operations/operational-product-runtime";
import { operationalDatabaseMode } from "@/features/auth/operational-preview-mode";
import {
  parseOwnerCleaningPricingSetup,
  type OwnerCleaningPricingSetup,
} from "./owner-cleaning-pricing-input";

type Resolver = typeof resolveStaffActor;

export interface PricingSetupProof {
  rateCardId: string;
  priceBookId: string;
  branchId: string;
  rateVersion: string;
  duplicate: boolean;
  state: "PERSISTED_OWNER_PRICING_VERIFIED";
  externalCustomerMessagesSent: 0;
}
export interface PricingSetupDependencies {
  resolveActor?: Resolver;
  mode?: typeof operationalDatabaseMode;
}

function fail(code: string, message: string): Result<never> {
  return { ok: false, code, message };
}
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value !== null && typeof value === "object") {
    const data = value as Record<string, unknown>;
    return "{" + Object.keys(data).sort()
      .map(key => JSON.stringify(key) + ":" + canonicalJson(data[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}
const uuid = (s: unknown): s is string =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

/**
 * Explicit first-run owner action only. The SQL command is transactional and
 * service-role-only. A verified authenticated session and active membership
 * must be established before the service-role client is invoked.
 */
export async function setupAuthorizedCleaningPricing(
  workspaceSlug: string,
  formData: FormData,
  deps: PricingSetupDependencies = {},
): Promise<Result<PricingSetupProof>> {
  const parsed = parseOwnerCleaningPricingSetup(formData);
  if (!parsed.ok) return parsed;

  if ((deps.mode ?? operationalDatabaseMode)() !== "SERVICE_ROLE") {
    return fail("PRICING_SETUP_BACKEND_UNAVAILABLE",
      "Protected owner pricing setup is unavailable. No prices have been saved.");
  }
  let authorized: Awaited<ReturnType<Resolver>>;
  try {
    authorized = await (deps.resolveActor ?? resolveStaffActor)(workspaceSlug);
  } catch {
    return fail("PRICING_SETUP_AUTH_UNAVAILABLE", "Could not verify the owner session.");
  }
  if (!authorized.ok) {
    return fail("PRICING_SETUP_AUTH_REQUIRED", "Sign in as a verified workspace owner.");
  }
  const { actor, workspace, branchScope, service, rpc } = authorized.value;
  if (workspace.slug !== workspaceSlug || !actor.userId ||
      actor.workspaceId !== workspace.id || actor.role !== "OWNER") {
    return fail("PRICING_SETUP_OWNER_REQUIRED", "An active workspace owner is required.");
  }
  const branch = branchScope.branches.find(item =>
    item.id === parsed.value.branchId && item.currency === "USD");
  if (!branch || (branchScope.mode === "BRANCH" &&
      branchScope.selectedBranchId !== parsed.value.branchId)) {
    return fail("PRICING_SETUP_BRANCH_FORBIDDEN",
      "Choose an authorized USD branch before activating pricing.");
  }

  const payload: OwnerCleaningPricingSetup = parsed.value;
  let response: Awaited<ReturnType<typeof rpc.rpc>>;
  try {
    response = await rpc.rpc("servicedesk_setup_owner_cleaning_pricing", {
      p_input: {
        ...payload,
        workspaceId: workspace.id,
        actorUserId: actor.userId,
        actorRole: actor.role,
      },
    });
  } catch {
    return fail("PRICING_SETUP_RPC_UNAVAILABLE",
      "The pricing save could not be confirmed. Reload Settings to check for a saved price book before retrying.");
  }
  if (response.error || !response.data ||
      typeof response.data !== "object" || Array.isArray(response.data)) {
    return fail("PRICING_SETUP_RPC_UNAVAILABLE",
      "The pricing save was not confirmed. Reload Settings to check for a saved price book before retrying.");
  }
  const saved = response.data as Record<string, unknown>;
  if (saved.ok !== true || !uuid(saved.rateCardId) || !uuid(saved.priceBookId) ||
      saved.branchId !== parsed.value.branchId ||
      typeof saved.rateVersion !== "string") {
    const code = typeof saved.code === "string" ? saved.code : "";
    if (code === "PRICING_SETUP_ALREADY_CONFIGURED") {
      return fail(code, "This branch already has pricing. Review its existing rate card; first-run setup cannot overwrite it.");
    }
    if (code === "PRICING_SETUP_OWNER_REQUIRED" ||
        code === "PRICING_SETUP_BRANCH_CURRENCY_INVALID") {
      return fail(code, "Workspace owner or branch currency authorization failed.");
    }
    return fail("PRICING_SETUP_WRITE_REJECTED",
      "Pricing setup was not verified; no successful configuration is claimed.");
  }

  // Proof is RLS-scope-bound by the same authorized SSR/privileged server
  // context. The SQL response alone must never become a success banner.
  try {
  const [catalog, rate, book] = await Promise.all([
    service.from("service_catalog").select("code,active,name")
      .eq("workspace_id", workspace.id).in("code", ["STANDARD","DEEP","MOVE_OUT"]),
    service.from("rate_cards").select("id,version,active,rules,currency")
      .eq("workspace_id", workspace.id).eq("id", saved.rateCardId).maybeSingle(),
    service.from("branch_price_books").select("id,rate_card_id,branch_id,active")
      .eq("workspace_id", workspace.id).eq("branch_id", branch.id)
      .eq("id", saved.priceBookId).maybeSingle(),
  ]);
  const actual = new Set((catalog.data ?? []).filter(x => x.active).map(x => x.code));
  const exactOwnerNames = (catalog.data ?? []).length === 3 &&
    (catalog.data ?? []).every(row => {
      const expectedName = row.code === "STANDARD" ? payload.serviceNames.STANDARD
        : row.code === "DEEP" ? payload.serviceNames.DEEP
        : row.code === "MOVE_OUT" ? payload.serviceNames.MOVE_OUT : null;
      return row.active === true && expectedName !== null && row.name === expectedName;
    });
  if (catalog.error || actual.size !== 3 || !exactOwnerNames ||
      !actual.has("STANDARD") || !actual.has("DEEP") || !actual.has("MOVE_OUT") ||
      rate.error || rate.data?.id !== saved.rateCardId ||
      rate.data?.active !== true || rate.data?.version !== saved.rateVersion ||
      rate.data?.currency?.trim() !== "USD" ||
      canonicalJson(rate.data?.rules) !== canonicalJson(payload.rules) ||
      book.error || book.data?.id !== saved.priceBookId ||
      book.data?.rate_card_id !== saved.rateCardId ||
      book.data?.branch_id !== branch.id || book.data?.active !== true) {
    return fail("PRICING_SETUP_READBACK_UNVERIFIED",
      "The pricing save may have committed, but exact persisted values were not confirmed. Reload Settings and verify the saved branch book before retrying.");
  }

  return { ok: true, value: {
    rateCardId: saved.rateCardId,
    priceBookId: saved.priceBookId,
    rateVersion: saved.rateVersion,
    branchId: branch.id,
    duplicate: saved.duplicate === true,
    state: "PERSISTED_OWNER_PRICING_VERIFIED",
    externalCustomerMessagesSent: 0,
  } };
  } catch {
    // An RPC can commit even if the subsequent read fails due to a transient
    // network/client error. Never throw a 500, declare that no write occurred
    // or encourage a new non-idempotent first-run setup request.
    return fail("PRICING_SETUP_READBACK_UNVERIFIED",
      "Pricing may already be saved, but the readback connection failed. Reload Settings and confirm the branch price book before trying again.");
  }
}
