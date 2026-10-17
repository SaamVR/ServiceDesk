import {
  parsePersistedQuoteRateCard,
  parsePriceBookWindowInstant,
} from "@/server/core/operational-quote-rate-card";

/**
 * Owner dashboard readiness must use the SAME persisted rate-card and
 * effective-window rules as actual saved-request quote calculation.
 * This is scoped to the caller's already-authorized workspace; never return
 * monetary amounts or raw owner/customer records to browser components.
 */
type RecordData = Record<string, unknown>;
const validUuid = (x: unknown): x is string => typeof x === "string" &&
  /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(x);
const supportedCodes = new Set(["STANDARD", "DEEP", "MOVE_OUT"]);
const MAX_PRICE_BOOK_SCAN = 100;

export function verifiedPricedOwnerBranchIds(input: {
  books: RecordData[];
  cards: RecordData[];
  services: RecordData[];
  now?: number;
}): string[] {
  const now = input.now ?? Date.now();
  if (!Number.isFinite(now) ||
      !Array.isArray(input.books) || !Array.isArray(input.cards) ||
      !Array.isArray(input.services)) return [];

  // A quote must refer to an active, persisted, supported service; no
  // synthetic rate cards or partial "baseMinor only" pricing qualifies.
  if (!input.services.some(row =>
    validUuid(row.id) && row.active === true && supportedCodes.has(String(row.code)))) {
    return [];
  }
  const completeUsdCardIds = new Set(input.cards.flatMap(card => {
    if (!validUuid(card.id)) return [];
    const result = parsePersistedQuoteRateCard(card);
    return result.ok && result.value.currency === "USD" ? [card.id] : [];
  }));

  // Invalid/contradictory active records and duplicate CURRENT books must
  // block readiness rather than be silently filtered from a "unique" book.
  const byBranch = new Map<string, RecordData[]>();
  for (const book of input.books) {
    if (book.active !== true || !validUuid(book.branch_id)) continue;
    const existing = byBranch.get(book.branch_id) ?? [];
    existing.push(book);
    byBranch.set(book.branch_id, existing);
  }
  const ready: string[] = [];
  for (const [branchId, books] of byBranch) {
    // The quote loader refuses >100 active books for a given branch.
    if (books.length > MAX_PRICE_BOOK_SCAN) continue;
    const windows = books.map(book => ({
      book,
      start: parsePriceBookWindowInstant(book.starts_at),
      end: parsePriceBookWindowInstant(book.ends_at),
    }));
    if (windows.some(w =>
      w.start === undefined || w.end === undefined ||
      (w.start !== null && w.end !== null && w.start >= w.end))) continue;
    const current = windows.filter(w =>
      w.start !== undefined && w.end !== undefined &&
      (w.start === null || w.start <= now) &&
      (w.end === null || w.end > now));
    if (current.length !== 1 ||
        !validUuid(current[0].book.rate_card_id) ||
        !completeUsdCardIds.has(current[0].book.rate_card_id)) continue;
    ready.push(branchId);
  }
  return ready;
}
