import type { SupabaseClient } from "@supabase/supabase-js";
import type { Result } from "../../contracts";
import type { RateCard, ServiceRateRule } from "../../domain/quote";

function fail(code: string, message: string): Result<never> {
  return { ok: false, code, message };
}
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    value >= min && value <= max;
}
function parseRule(value: unknown): ServiceRateRule | null {
  const row = record(value);
  if (!row) return null;
  for (const key of ["baseMinor", "baseMinutes", "bedroomMinor", "bedroomMinutes", "bathroomMinor", "bathroomMinutes"]) {
    const max = key.endsWith("Minutes") ? 1440 : 10_000_000;
    if (!integer(row[key], key === "baseMinutes" || key === "baseMinor" ? 1 : 0, max)) return null;
  }
  // An incomplete add-on cannot be turned into a free price or zero-minute
  // operation by the quote calculator's optional-field fallbacks.
  if ((row.ovenMinor === undefined) !== (row.ovenMinutes === undefined)) return null;
  for (const key of ["ovenMinor", "ovenMinutes"]) {
    const max = key.endsWith("Minutes") ? 1440 : 10_000_000;
    if (row[key] !== undefined && !integer(row[key], 0, max)) return null;
  }
  return {
    baseMinor: row.baseMinor as number,
    baseMinutes: row.baseMinutes as number,
    bedroomMinor: row.bedroomMinor as number,
    bedroomMinutes: row.bedroomMinutes as number,
    bathroomMinor: row.bathroomMinor as number,
    bathroomMinutes: row.bathroomMinutes as number,
    ...(row.ovenMinor === undefined ? {} : { ovenMinor: row.ovenMinor as number }),
    ...(row.ovenMinutes === undefined ? {} : { ovenMinutes: row.ovenMinutes as number }),
  };
}

export function parsePersistedQuoteRateCard(input: unknown): Result<RateCard> {
  const row = record(input);
  if (!row || row.active !== true || typeof row.version !== "string" ||
      row.version.length < 1 || row.version.length > 80 ||
      row.version === "synthetic-cleaning-v1") {
    return fail("QUOTE_RATE_CARD_INVALID", "A real active owner rate card is required.");
  }
  const currency = typeof row.currency === "string" ? row.currency.trim() : "";
  const rules = record(row.rules);
  if (!/^[A-Z]{3}$/.test(currency) ||
      !integer(row.deposit_percent, 0, 100) ||
      !integer(row.valid_hours, 1, 720) ||
      !integer(row.buffer_minutes, 0, 1440) ||
      !rules || !integer(rules.autoApprovalMaxTotalMinor, 0, 100_000_000)) {
    return fail("QUOTE_RATE_CARD_INVALID", "Rate-card currency, limits or pricing rules are invalid.");
  }
  const moveOut = parseRule(rules.moveOut);
  const standard = parseRule(rules.standard);
  const deep = parseRule(rules.deep);
  // MOVE_OUT exposes the oven option. A persisted owner card must explicitly
  // price and time it, even when both values are deliberately zero.
  if (!moveOut || moveOut.ovenMinor === undefined || moveOut.ovenMinutes === undefined || !standard || !deep) {
    return fail("QUOTE_RATE_CARD_INVALID", "Required cleaning pricing rules are missing or invalid.");
  }
  return { ok: true, value: {
    version: row.version,
    currency,
    depositPercent: row.deposit_percent,
    validHours: row.valid_hours,
    bufferMinutes: row.buffer_minutes,
    autoApprovalMaxTotalMinor: rules.autoApprovalMaxTotalMinor,
    moveOut, standard, deep,
  } as RateCard };
}

function asId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}

/**
 * Resolve pricing from the persisted request's actual branch price book and
 * workspace-bound active rate card. No synthetic fallback, no arbitrary
 * browser pricing input, no cross-tenant defaults.
 */
export async function loadOperationalQuoteRateCard(
  db: SupabaseClient,
  workspaceId: string,
  requestId: string,
  now = new Date(),
): Promise<Result<RateCard>> {
  if (!asId(workspaceId) || !asId(requestId)) {
    return fail("QUOTE_RATE_SCOPE_INVALID", "The saved request scope is invalid.");
  }

  const request = await db.from("requests")
    .select("branch_id,service_id")
    .eq("workspace_id", workspaceId).eq("id", requestId).maybeSingle();
  if (request.error) return fail("QUOTE_RATE_REQUEST_UNAVAILABLE", "The saved request could not be checked.");
  if (!request.data || !asId(request.data.branch_id) || !asId(request.data.service_id)) {
    return fail("QUOTE_RATE_REQUEST_INCOMPLETE", "Choose a saved request with an assigned cleaning service.");
  }
  // Price cards are denominated in currency minor units. A branch and a
  // card with different currencies must never produce a valid quote: the
  // amount may look plausible while representing the wrong denomination.
  const branch = await db.from("workspace_branches")
    .select("id,currency,active")
    .eq("workspace_id", workspaceId)
    .eq("id", request.data.branch_id)
    .maybeSingle();
  if (branch.error) return fail("QUOTE_RATE_BRANCH_UNAVAILABLE", "The request branch currency could not be checked.");
  if (!branch.data || branch.data.active !== true) {
    return fail("QUOTE_RATE_BRANCH_INACTIVE", "The cleaning branch is not active.");
  }
  const branchCurrency = typeof branch.data.currency === "string"
    ? branch.data.currency.trim() : "";
  if (!/^[A-Z]{3}$/.test(branchCurrency)) {
    return fail("QUOTE_RATE_BRANCH_CURRENCY_INVALID", "The branch currency is invalid.");
  }

  const service = await db.from("service_catalog")
    .select("code,active").eq("workspace_id", workspaceId)
    .eq("id", request.data.service_id).maybeSingle();
  if (service.error) return fail("QUOTE_RATE_CATALOG_UNAVAILABLE", "The active cleaning catalog is unavailable.");
  if (!service.data || service.data.active !== true ||
      !["MOVE_OUT", "STANDARD", "DEEP"].includes(service.data.code)) {
    return fail("QUOTE_RATE_SERVICE_INACTIVE", "An active supported cleaning service is required.");
  }

  // A truncated sample cannot prove uniqueness: another effective price
  // book might be outside it. Fetch one sentinel beyond the bounded scan.
  const MAX_PRICE_BOOK_SCAN = 100;
  const books = await db.from("branch_price_books")
    .select("rate_card_id,starts_at,ends_at")
    .eq("workspace_id", workspaceId)
    .eq("branch_id", request.data.branch_id)
    .eq("active", true).limit(MAX_PRICE_BOOK_SCAN + 1);
  if (books.error || !books.data || !Array.isArray(books.data))
    return fail("QUOTE_RATE_BOOK_UNAVAILABLE", "Branch pricing could not be verified.");
  if (books.data.length > MAX_PRICE_BOOK_SCAN)
    return fail("QUOTE_RATE_BOOK_SCAN_INCOMPLETE",
      "Too many active branch price books to verify pricing. Archive expired records before quoting.");
  const active = books.data.filter(book => {
    const start = book.starts_at == null ? Number.NEGATIVE_INFINITY : Date.parse(book.starts_at);
    const end = book.ends_at == null ? Number.POSITIVE_INFINITY : Date.parse(book.ends_at);
    return Number.isFinite(start) || start === Number.NEGATIVE_INFINITY
      ? (Number.isFinite(end) || end === Number.POSITIVE_INFINITY) &&
        start <= now.getTime() && end > now.getTime()
      : false;
  });
  if (active.length !== 1 || !asId(active[0].rate_card_id)) {
    return fail("QUOTE_RATE_BOOK_NOT_CONFIGURED", "Exactly one current branch price book is required.");
  }

  const card = await db.from("rate_cards")
    .select("version,currency,deposit_percent,valid_hours,buffer_minutes,active,rules")
    .eq("workspace_id", workspaceId)
    .eq("id", active[0].rate_card_id)
    .eq("active", true).maybeSingle();
  if (card.error) return fail("QUOTE_RATE_CARD_UNAVAILABLE", "Current branch rate card could not be read.");
  const validated = parsePersistedQuoteRateCard(card.data);
  if (!validated.ok) return validated;
  if (validated.value.currency !== branchCurrency) {
    return fail("QUOTE_RATE_BRANCH_CURRENCY_MISMATCH",
      "The approved rate card currency does not match the request branch. Correct pricing configuration before quoting.");
  }
  return validated;
}
