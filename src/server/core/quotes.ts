import type { Result } from "../../contracts";
import { createQuoteSnapshot, defaultRateCard, type QuoteServiceCode, type QuoteSnapshot } from "../../domain/quote";

export interface QuoteRepository {
  nextQuoteId(): string;
  findById(quoteId: string): Promise<QuoteSnapshot | undefined>;
  findLatestByRequest(requestId: string): Promise<QuoteSnapshot | undefined>;
  saveQuote(quote: QuoteSnapshot): Promise<void>;
  supersedeQuote(quoteId: string): Promise<void>;
  updateQuoteStatus(quoteId: string, status: QuoteSnapshot["status"]): Promise<void>;
}

export interface CreateQuoteDraftCommandInput {
  workspaceId: string;
  requestId: string;
  serviceCode: QuoteServiceCode;
  bedrooms: number;
  bathrooms: number;
  oven?: boolean;
  now: string;
}

export interface SendQuoteCommandMeta {
  expectedVersion?: number;
}

export interface AcceptQuoteCommandMeta {
  expectedVersion?: number;
  now: string;
}

export async function createQuoteDraftWithRepository(
  repository: QuoteRepository,
  input: CreateQuoteDraftCommandInput,
): Promise<Result<QuoteSnapshot>> {
  const previous = await repository.findLatestByRequest(input.requestId);
  const quote = createQuoteSnapshot({
    id: repository.nextQuoteId(),
    workspaceId: input.workspaceId,
    requestId: input.requestId,
    serviceCode: input.serviceCode,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    oven: input.oven,
    now: input.now,
  }, defaultRateCard);

  const versionedQuote: QuoteSnapshot = {
    ...quote,
    version: previous ? previous.version + 1 : 1,
  };

  if (previous) await repository.supersedeQuote(previous.id);
  await repository.saveQuote(versionedQuote);

  return { ok: true, value: versionedQuote };
}

export async function sendQuoteWithRepository(
  repository: QuoteRepository,
  requestId: string,
  meta: SendQuoteCommandMeta,
): Promise<Result<QuoteSnapshot>> {
  const quote = await repository.findLatestByRequest(requestId);
  return sendQuoteSnapshot(repository, quote, meta);
}

export async function sendQuoteByIdWithRepository(
  repository: QuoteRepository,
  quoteId: string,
  meta: SendQuoteCommandMeta,
): Promise<Result<QuoteSnapshot>> {
  const quote = await repository.findById(quoteId);
  return sendQuoteSnapshot(repository, quote, meta);
}

// This legacy repository seam still accepts quote status transitions. A Date
// comparison with NaN evaluates false, which used to ACCEPT an invalid or
// unzoned expiry. Validate real calendar days and explicit offsets first.
function trustedAcceptanceInstant(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 ||
      day > days[month - 1] || hour > 23 || minute > 59 || second > 59) return null;
  const zone = match[7];
  if (zone !== "Z") {
    const h = Number(zone.slice(1,3)), m = Number(zone.slice(4,6));
    if (h > 14 || m > 59 || (h === 14 && m !== 0)) return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function acceptQuoteByIdWithRepository(
  repository: QuoteRepository,
  quoteId: string,
  meta: AcceptQuoteCommandMeta,
): Promise<Result<QuoteSnapshot>> {
  const quote = await repository.findById(quoteId);
  if (!quote) return { ok: false, code: "QUOTE_NOT_FOUND", message: "No quote exists for this identifier." };

  if (meta.expectedVersion !== undefined && meta.expectedVersion !== quote.version) {
    return { ok: false, code: "VERSION_CONFLICT", message: "Quote version changed before acceptance." };
  }

  if (quote.status !== "SENT") {
    return { ok: false, code: "QUOTE_NOT_SENT", message: "Only a sent quote can be accepted." };
  }

  const nowInstant = trustedAcceptanceInstant(meta.now);
  const expiryInstant = trustedAcceptanceInstant(quote.validUntil);
  if (nowInstant === null || expiryInstant === null || expiryInstant <= nowInstant) {
    return { ok: false, code: "QUOTE_EXPIRED", message: "Quote validity window has expired." };
  }

  const accepted: QuoteSnapshot = { ...quote, status: "ACCEPTED" };
  await repository.updateQuoteStatus(quote.id, "ACCEPTED");
  return { ok: true, value: accepted };
}

async function sendQuoteSnapshot(
  repository: QuoteRepository,
  quote: QuoteSnapshot | undefined,
  meta: SendQuoteCommandMeta,
): Promise<Result<QuoteSnapshot>> {
  if (!quote) return { ok: false, code: "QUOTE_NOT_FOUND", message: "No quote exists for this identifier." };

  if (meta.expectedVersion !== undefined && meta.expectedVersion !== quote.version) {
    return { ok: false, code: "VERSION_CONFLICT", message: "Quote version changed before send." };
  }

  if (quote.status !== "APPROVED") {
    return { ok: false, code: "QUOTE_APPROVAL_REQUIRED", message: "Only approved quotes can be sent." };
  }

  const sent: QuoteSnapshot = { ...quote, status: "SENT" };
  await repository.updateQuoteStatus(quote.id, "SENT");
  return { ok: true, value: sent };
}
