import type { Result } from "../../contracts";
import { resolveStaffActor, type OperationalBranch } from "@/features/operations/operational-product-runtime";
import { operationalDatabaseMode } from "@/features/auth/operational-preview-mode";
import { parseOwnerCleaningPricingSetup } from "./owner-cleaning-pricing-input";

type Resolver = typeof resolveStaffActor;
const uuid = (s: unknown): s is string =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const fail = (code: string, message: string): Result<never> => ({ ok: false, code, message });
const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return "{" + Object.keys(obj).sort().map(key => JSON.stringify(key) + ":" + canonicalJson(obj[key])).join(",") + "}";
  }
  return JSON.stringify(value);
};

export interface OwnerExistingPricingBook {
  branch: OperationalBranch;
  bookId: string;
  bookVersion: number;
  rateCardId: string;
  rateVersion: string | null;
  rateCurrency: string | null;
  depositPercent: number | null;
  validHours: number | null;
  bufferMinutes: number | null;
  startsAt: string | null;
  endsAt: string | null;
  /** Read-only, untrusted saved rules for the authenticated owner to review. */
  rules: unknown;
}

export interface OwnerPricingRevisionProof {
  state: "PERSISTED_OWNER_PRICING_REVISION_VERIFIED";
  branchId: string;
  priceBookId: string;
  rateCardId: string;
  rateVersion: string;
  duplicate: boolean;
  externalCustomerMessagesSent: 0;
}
export interface OwnerPricingRevisionDeps {
  resolveActor?: Resolver;
  mode?: typeof operationalDatabaseMode;
}

export function parsePricingRevisionExpected(form: FormData):
  Result<{ expectedBookId: string; expectedBookVersion: number }> {
  const book = form.get("expectedBookId");
  const version = form.get("expectedBookVersion");
  if (!uuid(book) || typeof version !== "string" ||
      !/^[1-9][0-9]{0,8}$/.test(version)) {
    return fail("PRICING_REVISION_EXPECTED_INVALID", "Reload current pricing before revising it.");
  }
  const n = Number(version);
  if (!Number.isSafeInteger(n) || n > 1_000_000_000) {
    return fail("PRICING_REVISION_EXPECTED_INVALID", "Reload current pricing before revising it.");
  }
  return { ok: true, value: { expectedBookId: book, expectedBookVersion: n } };
}

/** Read only active books for branches already authorized by a verified owner session. */
export async function loadAuthorizedOwnerPricingBooks(
  workspaceSlug: string,
  deps: OwnerPricingRevisionDeps = {},
): Promise<Result<OwnerExistingPricingBook[]>> {
  if ((deps.mode ?? operationalDatabaseMode)() !== "SERVICE_ROLE") {
    return fail("PRICING_REVISION_BACKEND_UNAVAILABLE", "Owner pricing records are temporarily unavailable.");
  }
  let resolution: Awaited<ReturnType<Resolver>>;
  try { resolution = await (deps.resolveActor ?? resolveStaffActor)(workspaceSlug); }
  catch { return fail("PRICING_REVISION_AUTH_UNAVAILABLE", "Could not authenticate this workspace."); }
  if (!resolution.ok) return fail("PRICING_REVISION_AUTH_REQUIRED", "Sign in as the workspace owner.");
  const { workspace, actor, branchScope, service } = resolution.value;
  if (workspace.slug !== workspaceSlug || actor.workspaceId !== workspace.id ||
      !actor.userId || actor.role !== "OWNER") {
    return fail("PRICING_REVISION_OWNER_REQUIRED", "Only an active owner can see or revise branch pricing.");
  }
  const allowed = branchScope.branches.filter(branch => branch.currency === "USD" &&
    (branchScope.mode !== "BRANCH" || branch.id === branchScope.selectedBranchId));
  if (!allowed.length) return { ok: true, value: [] };
  try {
    const bookRead = await service.from("branch_price_books")
      .select("id,workspace_id,branch_id,rate_card_id,version,active,starts_at,ends_at")
      .eq("workspace_id", workspace.id).eq("active", true)
      .in("branch_id", allowed.map(branch => branch.id)).limit(200);
    if (bookRead.error || !Array.isArray(bookRead.data) || bookRead.data.length >= 200) {
      return fail("PRICING_REVISION_EVIDENCE_UNAVAILABLE", "The active price-book read could not be verified.");
    }
    if (!bookRead.data.length) return { ok: true, value: [] };
    const cardRead = await service.from("rate_cards")
      .select("id,workspace_id,version,currency,deposit_percent,valid_hours,buffer_minutes,rules")
      .eq("workspace_id", workspace.id)
      .in("id", bookRead.data.map(book => book.rate_card_id)).limit(200);
    if (cardRead.error || !Array.isArray(cardRead.data) || cardRead.data.length >= 200) {
      return fail("PRICING_REVISION_EVIDENCE_UNAVAILABLE", "Saved rate-card details could not be verified.");
    }
    const books: OwnerExistingPricingBook[] = [];
    for (const row of bookRead.data) {
      const branch = allowed.find(item => item.id === row.branch_id);
      const version = Number(row.version);
      if (!branch || !uuid(row.id) || !uuid(row.rate_card_id) ||
          !Number.isSafeInteger(version) || version < 1 || version > 1_000_000_000) {
        return fail("PRICING_REVISION_EVIDENCE_UNAVAILABLE", "The active book contains invalid identifiers.");
      }
      const rate = cardRead.data.find(card => card.id === row.rate_card_id);
      // A missing/malformed rate card is the defect being repaired. Never synthesize its prices.
      const safeNumber = (value: unknown): number | null =>
        typeof value === "number" && Number.isSafeInteger(value) ? value : null;
      books.push({
        branch, bookId: row.id, bookVersion: version, rateCardId: row.rate_card_id,
        rateVersion: typeof rate?.version === "string" ? rate.version : null,
        rateCurrency: typeof rate?.currency === "string" ? rate.currency.trim() : null,
        depositPercent: safeNumber(rate?.deposit_percent),
        validHours: safeNumber(rate?.valid_hours),
        bufferMinutes: safeNumber(rate?.buffer_minutes),
        startsAt: typeof row.starts_at === "string" ? row.starts_at : null,
        endsAt: typeof row.ends_at === "string" ? row.ends_at : null,
        rules: rate?.rules ?? null,
      });
    }
    if (new Set(books.map(book => book.branch.id)).size !== books.length) {
      return fail("PRICING_REVISION_EVIDENCE_UNAVAILABLE", "Conflicting active books require operator review.");
    }
    return { ok: true, value: books };
  } catch {
    return fail("PRICING_REVISION_EVIDENCE_UNAVAILABLE", "Saved pricing could not be read safely.");
  }
}

/**
 * Owner-initiated, fully specified replacement. No AI, customer message or
 * automatic scheduling. SQL independently rechecks membership, branch and CAS.
 */
export async function reviseAuthorizedCleaningPricing(
  workspaceSlug: string,
  form: FormData,
  deps: OwnerPricingRevisionDeps = {},
): Promise<Result<OwnerPricingRevisionProof>> {
  const parsed = parseOwnerCleaningPricingSetup(form);
  if (!parsed.ok) return parsed;
  const expected = parsePricingRevisionExpected(form);
  if (!expected.ok) return expected;
  if ((deps.mode ?? operationalDatabaseMode)() !== "SERVICE_ROLE") {
    return fail("PRICING_REVISION_BACKEND_UNAVAILABLE",
      "Protected pricing revision is not installed or configured. Nothing was changed.");
  }
  let resolution: Awaited<ReturnType<Resolver>>;
  try { resolution = await (deps.resolveActor ?? resolveStaffActor)(workspaceSlug); }
  catch { return fail("PRICING_REVISION_AUTH_UNAVAILABLE", "Could not verify the owner session."); }
  if (!resolution.ok) return fail("PRICING_REVISION_AUTH_REQUIRED", "Sign in as a verified owner.");
  const { workspace, actor, branchScope, rpc, service } = resolution.value;
  if (workspace.slug !== workspaceSlug || actor.workspaceId !== workspace.id ||
      actor.role !== "OWNER" || !actor.userId) {
    return fail("PRICING_REVISION_OWNER_REQUIRED", "Only the active workspace owner can revise pricing.");
  }
  const branch = branchScope.branches.find(item => item.id === parsed.value.branchId &&
    item.currency === parsed.value.currency);
  if (!branch || (branchScope.mode === "BRANCH" &&
      branchScope.selectedBranchId !== branch.id)) {
    return fail("PRICING_REVISION_BRANCH_FORBIDDEN", "This branch is outside the owner's authorized scope.");
  }
  let response: Awaited<ReturnType<typeof rpc.rpc>>;
  try {
    response = await rpc.rpc("servicedesk_revise_owner_cleaning_pricing", {
      p_input: {
        ...parsed.value, ...expected.value,
        workspaceId: workspace.id, actorUserId: actor.userId, actorRole: actor.role,
      },
    });
  } catch {
    return fail("PRICING_REVISION_RPC_UNAVAILABLE",
      "The revision may have committed. Reload Settings and verify the active price book before retrying.");
  }
  if (response.error || !response.data || typeof response.data !== "object" ||
      Array.isArray(response.data)) {
    return fail("PRICING_REVISION_RPC_UNAVAILABLE",
      "The revision was not confirmed. Check the current price book before retrying.");
  }
  const saved = response.data as Record<string, unknown>;
  if (saved.ok !== true || !uuid(saved.priceBookId) || !uuid(saved.rateCardId) ||
      saved.branchId !== branch.id ||
      saved.rateVersion !== "owner-cleaning-revision-" + parsed.value.setupId ||
      (saved.duplicate !== true && saved.duplicate !== false)) {
    if (saved.code === "PRICING_REVISION_VERSION_CONFLICT") {
      return fail("PRICING_REVISION_VERSION_CONFLICT",
        "Another change replaced this price book. Reload the latest version before saving.");
    }
    if (saved.code === "PRICING_REVISION_IDEMPOTENCY_CONFLICT") {
      return fail("PRICING_REVISION_IDEMPOTENCY_CONFLICT",
        "This revision key was already used with different values. Reload before revising.");
    }
    return fail("PRICING_REVISION_WRITE_REJECTED",
      "The requested revision was not verified. Check the active book before retrying.");
  }

  // Exact persisted readback; the RPC response alone is not proof.
  try {
    const [books, oldBook, rate, catalog] = await Promise.all([
      service.from("branch_price_books").select("id,rate_card_id,branch_id,active")
        .eq("workspace_id", workspace.id).eq("branch_id", branch.id).eq("active", true),
      service.from("branch_price_books").select("id,active")
        .eq("workspace_id", workspace.id).eq("id", expected.value.expectedBookId).maybeSingle(),
      service.from("rate_cards").select("id,version,active,rules,currency,deposit_percent,valid_hours,buffer_minutes")
        .eq("workspace_id", workspace.id).eq("id", saved.rateCardId).maybeSingle(),
      service.from("service_catalog").select("code,name,active")
        .eq("workspace_id", workspace.id).in("code", ["STANDARD","DEEP","MOVE_OUT"]),
    ]);
    const active = books.data;
    if (books.error || !Array.isArray(active) || active.length !== 1 ||
        active[0].id !== saved.priceBookId || active[0].rate_card_id !== saved.rateCardId ||
        active[0].branch_id !== branch.id || active[0].active !== true ||
        oldBook.error || oldBook.data?.id !== expected.value.expectedBookId ||
        oldBook.data?.active !== false ||
        rate.error || rate.data?.id !== saved.rateCardId ||
        rate.data?.active !== true || rate.data?.version !== saved.rateVersion ||
        String(rate.data?.currency).trim() !== parsed.value.currency ||
        rate.data?.deposit_percent !== parsed.value.depositPercent ||
        rate.data?.valid_hours !== parsed.value.validHours ||
        rate.data?.buffer_minutes !== parsed.value.bufferMinutes ||
        canonicalJson(rate.data?.rules) !== canonicalJson(parsed.value.rules) ||
        catalog.error || !Array.isArray(catalog.data) || catalog.data.length !== 3 ||
        !catalog.data.every(row =>
          row.active === true &&
          (row.code === "STANDARD" || row.code === "DEEP" || row.code === "MOVE_OUT") &&
          row.name === parsed.value.serviceNames[row.code as "STANDARD" | "DEEP" | "MOVE_OUT"])) {
      return fail("PRICING_REVISION_READBACK_UNVERIFIED",
        "Pricing may have changed, but independent database readback did not confirm it. Reload Settings.");
    }
    return { ok: true, value: {
      state: "PERSISTED_OWNER_PRICING_REVISION_VERIFIED",
      branchId: branch.id, rateCardId: saved.rateCardId,
      priceBookId: saved.priceBookId, rateVersion: saved.rateVersion,
      duplicate: saved.duplicate === true, externalCustomerMessagesSent: 0,
    } };
  } catch {
    return fail("PRICING_REVISION_READBACK_UNVERIFIED",
      "Pricing may have changed. Readback is unavailable; reload Settings before any retry.");
  }
}
