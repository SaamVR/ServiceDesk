import type { Result } from "../../contracts";
import { resolveStaffActor } from "@/features/operations/operational-product-runtime";
import { loadOperationalQuoteRateCard } from "@/server/core/operational-quote-rate-card";
import { createQuoteSnapshot, type QuoteServiceCode } from "@/domain/quote";

/** Verified pricing proposals, never saved/sent quotes or price predictions. */
type Resolver = typeof resolveStaffActor;
type Reader = typeof loadOperationalQuoteRateCard;
export interface GroundedAlternativesInput {
  workspaceSlug: string;
  requestId: string;
  expectedVersion: number;
  now?: Date;
}
export interface GroundedAlternativesDependencies {
  resolveActor?: Resolver;
  readRateCard?: Reader;
}
export interface GroundedQuoteAlternative {
  serviceCode: QuoteServiceCode;
  variant: "BASE" | "OPTIONAL_OVEN";
  currency: string;
  totalMinor: number;
  depositMinor: number;
  balanceMinor: number;
  durationMinutes: number;
  rateVersion: string;
  requiresStaffServiceSelection: boolean;
  requiresStaffAddonConfirmation: boolean;
}
export interface GroundedQuoteAlternatives {
  state: "STAFF_APPROVAL_REQUIRED";
  source: "AUTHORIZED_SAVED_REQUEST_AND_BRANCH_PRICE_BOOK";
  workspaceId: string;
  requestId: string;
  requestVersion: number;
  branchId: string;
  options: GroundedQuoteAlternative[];
  savedQuoteCreated: false;
  customerContactSent: false;
}
const validId = (v: unknown): v is string => typeof v === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const fail = (code: string): Result<never> => ({
  ok: false, code, message: "Verified saved branch pricing or request authority is unavailable.",
});
type Row = Record<string, unknown>;
const fields = ["id", "workspace_id", "branch_id", "service_id", "status", "version", "bedrooms", "bathrooms"] as const;
function validRequest(row: unknown, requestId: string, workspaceId: string, version: number): row is Row {
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  const r = row as Row;
  return r.id === requestId && r.workspace_id === workspaceId &&
    validId(r.branch_id) && validId(r.service_id) && r.version === version &&
    typeof r.status === "string" && /^[A-Z_]{2,40}$/.test(r.status) &&
    !["CANCELLED","CLOSED","REJECTED","DECLINED"].includes(r.status) &&
    [r.bedrooms,r.bathrooms].every(n => typeof n === "number" &&
      Number.isSafeInteger(n) && n >= 0 && n <= 10);
}
function catalogCodes(rows: unknown, workspaceId: string): QuoteServiceCode[] | null {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) return null;
  const codes: QuoteServiceCode[] = [];
  const ids = new Set<string>();
  for (const raw of rows as unknown[]) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as Row;
    if (!validId(row.id) || ids.has(row.id) ||
        row.workspace_id !== workspaceId || row.active !== true ||
        typeof row.requires_review !== "boolean" ||
        !["STANDARD", "DEEP", "MOVE_OUT"].includes(String(row.code)) ||
        codes.includes(row.code as QuoteServiceCode)) return null;
    ids.add(row.id);
    codes.push(row.code as QuoteServiceCode);
  }
  return codes.sort();
}
export async function proposeAuthorizedGroundedQuoteAlternatives(
  input: GroundedAlternativesInput,
  deps: GroundedAlternativesDependencies = {},
): Promise<Result<GroundedQuoteAlternatives>> {
  if (!input || typeof input.workspaceSlug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.workspaceSlug) ||
      input.workspaceSlug.length > 40 || !validId(input.requestId) ||
      !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1)
    return fail("F01_QUOTE_INPUT_INVALID");
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
    return fail("F01_QUOTE_CLOCK_INVALID");
  const resolver = deps.resolveActor ?? resolveStaffActor;
  let first: Awaited<ReturnType<Resolver>>;
  try { first = await resolver(input.workspaceSlug); }
  catch { return fail("F01_QUOTE_AUTH_UNAVAILABLE"); }
  if (!first.ok) return fail("F01_QUOTE_AUTH_DENIED");
  const { actor, workspace, branchScope } = first.value;
  if (workspace.slug !== input.workspaceSlug || actor.workspaceId !== workspace.id ||
      !actor.userId || !["OWNER","DISPATCHER"].includes(actor.role) ||
      (actor.role === "DISPATCHER" &&
       (branchScope.mode !== "BRANCH" || !validId(branchScope.selectedBranchId))))
    return fail("F01_QUOTE_AUTH_DENIED");

  async function readRequest(db: typeof first.value.service): Promise<Row | null> {
    try {
      const r = await db.from("requests")
        .select(fields.join(",")).eq("workspace_id",workspace.id)
        .eq("id",input.requestId).maybeSingle();
      return r.error ? null : r.data as Row | null;
    } catch { return null; }
  }
  async function readCatalog(db: typeof first.value.service): Promise<unknown[] | null> {
    try {
      const r = await db.from("service_catalog")
        .select("id,workspace_id,code,active,requires_review")
        .eq("workspace_id",workspace.id).eq("active",true).limit(101);
      return r.error || !Array.isArray(r.data) || r.data.length > 100 ? null : r.data;
    } catch { return null; }
  }
  const saved = await readRequest(first.value.service);
  if (!validRequest(saved, input.requestId, workspace.id, input.expectedVersion))
    return fail("F01_QUOTE_SAVED_REQUEST_INVALID");
  if (actor.role === "DISPATCHER" && saved.branch_id !== branchScope.selectedBranchId)
    return fail("F01_QUOTE_SCOPE_DENIED");
  const rawCatalog = await readCatalog(first.value.service);
  const codes = catalogCodes(rawCatalog,workspace.id);
  if (!codes || !Array.isArray(rawCatalog) ||
      !rawCatalog.some(raw => (raw as Row).id === saved.service_id))
    return fail("F01_QUOTE_CATALOG_UNVERIFIED");
  const selectedService = (rawCatalog.find(raw => (raw as Row).id === saved.service_id) as Row).code as QuoteServiceCode;

  // Core loader validates saved request -> actual active branch -> exact one
  // effective book -> active owner rate card, currency match and rule shape.
  const rateReader = deps.readRateCard ?? loadOperationalQuoteRateCard;
  let verified: Awaited<ReturnType<Reader>>;
  try { verified = await rateReader(first.value.service,workspace.id,input.requestId,now); }
  catch { return fail("F01_QUOTE_RATE_UNAVAILABLE"); }
  if (!verified.ok) return fail(verified.code);
  const rate = verified.value;
  if (rate.version === "synthetic-cleaning-v1" || !/^[A-Z]{3}$/.test(rate.currency))
    return fail("F01_QUOTE_RATE_INVALID");

  let current: Awaited<ReturnType<Resolver>>;
  try { current = await resolver(input.workspaceSlug); }
  catch { return fail("F01_QUOTE_REVALIDATION_UNAVAILABLE"); }
  if (!current.ok || current.value.workspace.id !== workspace.id ||
      current.value.workspace.slug !== workspace.slug ||
      current.value.actor.userId !== actor.userId ||
      current.value.actor.workspaceId !== actor.workspaceId ||
      current.value.actor.role !== actor.role ||
      (actor.role === "DISPATCHER" &&
       (current.value.branchScope.mode !== "BRANCH" ||
        current.value.branchScope.selectedBranchId !== branchScope.selectedBranchId)))
    return fail("F01_QUOTE_AUTH_CHANGED");
  const latest = await readRequest(current.value.service);
  if (!latest || fields.some(k => latest[k] !== saved[k]))
    return fail("F01_QUOTE_SOURCE_CHANGED");
  const currentCatalog = await readCatalog(current.value.service);
  if (JSON.stringify(currentCatalog) !== JSON.stringify(rawCatalog))
    return fail("F01_QUOTE_CATALOG_CHANGED");
  let rerated: Awaited<ReturnType<Reader>>;
  try { rerated = await rateReader(current.value.service,workspace.id,input.requestId,now); }
  catch { return fail("F01_QUOTE_RATE_CHANGED"); }
  if (!rerated.ok || JSON.stringify(rerated.value) !== JSON.stringify(rate))
    return fail("F01_QUOTE_RATE_CHANGED");

  const options: GroundedQuoteAlternative[] = [];
  // Only saved, active supported service codes qualify. Alternatives to
  // selected service require fresh, explicit staff/customer selection later.
  for (const serviceCode of [selectedService, ...codes.filter(code => code !== selectedService)]) {
    for (const variant of (serviceCode === "MOVE_OUT" ? ["BASE","OPTIONAL_OVEN"] : ["BASE"]) as Array<"BASE"|"OPTIONAL_OVEN">) {
      let candidate: ReturnType<typeof createQuoteSnapshot>;
      try {
        candidate = createQuoteSnapshot({
          id: input.requestId, workspaceId: workspace.id, requestId: input.requestId,
          serviceCode, bedrooms: saved.bedrooms as number, bathrooms: saved.bathrooms as number,
          oven: variant === "OPTIONAL_OVEN", now: now.toISOString(),
        },rate);
      } catch { return fail("F01_QUOTE_CALCULATION_INVALID"); }
      if (!Number.isSafeInteger(candidate.totalMinor) || candidate.totalMinor < 1 ||
          !Number.isSafeInteger(candidate.durationMinutes) || candidate.durationMinutes < 1)
        return fail("F01_QUOTE_AMOUNT_INVALID");
      options.push({
        serviceCode, variant, currency: candidate.currency,
        totalMinor: candidate.totalMinor, depositMinor: candidate.depositMinor,
        balanceMinor: candidate.balanceMinor, durationMinutes: candidate.durationMinutes,
        rateVersion: rate.version, requiresStaffServiceSelection: serviceCode !== selectedService,
        requiresStaffAddonConfirmation: variant === "OPTIONAL_OVEN",
      });
    }
  }
  return { ok: true, value: {
    state: "STAFF_APPROVAL_REQUIRED", source: "AUTHORIZED_SAVED_REQUEST_AND_BRANCH_PRICE_BOOK",
    workspaceId: workspace.id, requestId: input.requestId, requestVersion: input.expectedVersion,
    branchId: saved.branch_id as string, options,
    savedQuoteCreated: false, customerContactSent: false,
  } };
}
