import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * An enabled automation needs evidence of a REAL priced service in the exact
 * eligible USD branch, not merely an active price-book pointer. Every read is
 * scoped to the already verified owner workspace and fails closed.
 */
export type QuoteAutomationActivationProof =
  | { ok: true; branchId: string; ruleId: string }
  | { ok: false; code: "AUTO_QUOTE_SERVICE_MISSING" |
      "AUTO_QUOTE_PRICING_MISSING" | "AUTO_QUOTE_INTERNAL_RULE_MISSING" |
      "AUTO_QUOTE_PREREQUISITES_UNVERIFIED" };

type ServiceReader = Pick<SupabaseClient, "from">;

const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value);

const unverified = (): QuoteAutomationActivationProof =>
  ({ ok: false, code: "AUTO_QUOTE_PREREQUISITES_UNVERIFIED" });

const serviceRuleName: Record<string, "standard" | "deep" | "moveOut"> = {
  STANDARD: "standard", DEEP: "deep", MOVE_OUT: "moveOut",
};

function positiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function cardHasQuotableService(rules: unknown, serviceCodes: Set<string>): boolean {
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) return false;
  const fields = rules as Record<string, unknown>;
  return [...serviceCodes].some(code => {
    const rule = fields[serviceRuleName[code]];
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) return false;
    const values = rule as Record<string, unknown>;
    // A catalog item with no real base price/duration is not a configured
    // cleaning service merely because a rate-card row is active.
    return positiveInteger(values.baseMinor) && positiveInteger(values.baseMinutes);
  });
}

/**
 * Saved timestamptz evidence MUST include an explicit timezone and a real
 * calendar date. Date.parse alone normalizes dates such as February 30 and
 * silently treats unzoned strings according to the host timezone.
 */
function effectiveWindow(start: unknown, end: unknown, now: number):
  { valid: boolean; current: boolean } {
  const bound = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") return NaN;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!match) return NaN;
    const [, year, month, day, hour, minute, second, zone] = match;
    const y=Number(year), m=Number(month), d=Number(day);
    const clock=[Number(hour), Number(minute), Number(second)];
    const date=new Date(Date.UTC(y,m-1,d));
    if (date.getUTCFullYear()!==y || date.getUTCMonth()!==m-1 ||
        date.getUTCDate()!==d || clock[0]>23 || clock[1]>59 ||
        clock[2]>59 || y<1000) return NaN;
    if (zone!=="Z") {
      const hh=Number(zone.slice(1,3)), mm=Number(zone.slice(4,6));
      if (hh>14 || mm>59 || hh===14 && mm!==0) return NaN;
    }
    const parsed=Date.parse(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  const begins=bound(start), ends=bound(end);
  if (Number.isNaN(begins) || Number.isNaN(ends) ||
      begins!==null && ends!==null && begins>=ends) {
    return {valid:false,current:false};
  }
  return {valid:true,current:(begins===null || begins<=now) &&
    (ends===null || ends>now)};
}

export async function verifyOwnerQuoteAutomationPrerequisites(
  service: ServiceReader,
  trustedWorkspaceId: string,
): Promise<QuoteAutomationActivationProof> {
  if (!uuid(trustedWorkspaceId)) return unverified();
  try {
    // Query size is bounded; a truncated result can never approve automation.
    const [catalog, branches, books, rateCards, rules] = await Promise.all([
      service.from("service_catalog").select("id,code,active")
        .eq("workspace_id", trustedWorkspaceId).eq("active", true).limit(201),
      service.from("workspace_branches").select("id,currency,active")
        .eq("workspace_id", trustedWorkspaceId).eq("active", true).limit(201),
      service.from("branch_price_books")
        .select("branch_id,rate_card_id,active,starts_at,ends_at")
        .eq("workspace_id", trustedWorkspaceId).eq("active", true).limit(201),
      service.from("rate_cards").select("id,currency,active,rules")
        .eq("workspace_id", trustedWorkspaceId).eq("active", true)
        .eq("currency", "USD").limit(201),
      service.from("workflow_rules").select("id,branch_id,published_version_number,status")
        .eq("workspace_id", trustedWorkspaceId).eq("status", "ACTIVE").limit(201),
    ]);
    if (catalog.error || branches.error || books.error ||
        rateCards.error || rules.error ||
        !Array.isArray(catalog.data) || catalog.data.length >= 201 ||
        !Array.isArray(branches.data) || branches.data.length >= 201 ||
        !Array.isArray(books.data) || books.data.length >= 201 ||
        !Array.isArray(rateCards.data) || rateCards.data.length >= 201 ||
        !Array.isArray(rules.data) || rules.data.length >= 201) return unverified();

    const supportedServices = new Set(catalog.data
      .filter(row => uuid(row.id) && row.active === true &&
        typeof row.code === "string" && row.code in serviceRuleName)
      .map(row => row.code as string));
    if (!supportedServices.size) {
      return { ok: false, code: "AUTO_QUOTE_SERVICE_MISSING" };
    }

    const usdBranches = new Set(branches.data.filter(row =>
      uuid(row.id) && row.currency?.trim() === "USD" && row.active === true,
    ).map(row => row.id as string));
    const cards = new Map(rateCards.data.filter(row => uuid(row.id) &&
      row.active === true && row.currency?.trim() === "USD" &&
      cardHasQuotableService(row.rules, supportedServices),
    ).map(row => [row.id as string, row]));
    const now = Date.now();
    // A single seemingly valid book does NOT make pricing usable if a second
    // effective active book exists in the same branch. Owner activation must
    // fail closed exactly where real quote pricing rejects ambiguous books.
    const effectiveBooks = new Map<string, { count: number; cardValid: boolean }>();
    const malformedBranches = new Set<string>();
    for (const row of books.data) {
      if (!uuid(row.branch_id) || !usdBranches.has(row.branch_id) ||
          row.active !== true) continue;
      const window=effectiveWindow(row.starts_at,row.ends_at,now);
      if (!window.valid) {
        malformedBranches.add(row.branch_id);
        continue;
      }
      if (!window.current) continue;
      const previous=effectiveBooks.get(row.branch_id) ?? {count:0,cardValid:true};
      effectiveBooks.set(row.branch_id,{
        count:previous.count+1,
        cardValid:previous.cardValid &&
          uuid(row.rate_card_id) && cards.has(row.rate_card_id),
      });
    }
    const pricedBranches=new Set([...effectiveBooks.entries()]
      .filter(([branchId, proof]) =>
        !malformedBranches.has(branchId) && proof.count===1 && proof.cardValid)
      .map(([branchId])=>branchId));
    if (!pricedBranches.size) {
      return { ok: false, code: "AUTO_QUOTE_PRICING_MISSING" };
    }

    const candidates = rules.data.filter(row =>
      uuid(row.id) && uuid(row.branch_id) &&
      pricedBranches.has(row.branch_id) && row.status === "ACTIVE" &&
      Number.isSafeInteger(row.published_version_number) &&
      row.published_version_number > 0,
    );
    if (candidates.length > 40) return unverified();
    for (const rule of candidates) {
      const version = await service.from("workflow_rule_versions")
        .select("rule_id,branch_id,version_number,state,event_type,actions")
        .eq("workspace_id", trustedWorkspaceId)
        .eq("rule_id", rule.id).eq("branch_id", rule.branch_id)
        .eq("version_number", rule.published_version_number)
        .eq("state", "PUBLISHED").eq("event_type", "QUOTE_ACCEPTED").maybeSingle();
      if (version.error) return unverified();
      if (!version.data) continue;
      if (version.data.rule_id !== rule.id ||
          version.data.branch_id !== rule.branch_id ||
          version.data.version_number !== rule.published_version_number ||
          version.data.state !== "PUBLISHED" ||
          version.data.event_type !== "QUOTE_ACCEPTED" ||
          !Array.isArray(version.data.actions)) return unverified();
      if (version.data.actions.some((action: unknown) =>
        action !== null && typeof action === "object" &&
        "type" in action && action.type === "CREATE_ATTENTION")) {
        return { ok: true, branchId: rule.branch_id, ruleId: rule.id };
      }
    }
    return { ok: false, code: "AUTO_QUOTE_INTERNAL_RULE_MISSING" };
  } catch {
    return unverified();
  }
}
