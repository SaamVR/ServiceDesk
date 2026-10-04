import type { Result } from "../../contracts";
import { createQuoteSnapshot, defaultRateCard, type QuoteServiceCode, type QuoteSnapshot } from "../../domain/quote";

export interface QuoteRepository {
  nextQuoteId(): string;
  findLatestByRequest(requestId: string): QuoteSnapshot | undefined;
  saveQuote(quote: QuoteSnapshot): void;
  supersedeQuote(quoteId: string): void;
  updateQuoteStatus(quoteId: string, status: QuoteSnapshot["status"]): void;
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

export function createQuoteDraftWithRepository(
  repository: QuoteRepository,
  input: CreateQuoteDraftCommandInput,
): Result<QuoteSnapshot> {
  const previous = repository.findLatestByRequest(input.requestId);
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

  if (previous) repository.supersedeQuote(previous.id);
  repository.saveQuote(versionedQuote);

  return { ok: true, value: versionedQuote };
}

export function sendQuoteWithRepository(
  repository: QuoteRepository,
  requestId: string,
  meta: SendQuoteCommandMeta,
): Result<QuoteSnapshot> {
  const quote = repository.findLatestByRequest(requestId);
  if (!quote) return { ok: false, code: "QUOTE_NOT_FOUND", message: "No quote exists for this request." };

  if (meta.expectedVersion !== undefined && meta.expectedVersion !== quote.version) {
    return { ok: false, code: "VERSION_CONFLICT", message: "Quote version changed before send." };
  }

  if (quote.status !== "APPROVED") {
    return { ok: false, code: "QUOTE_APPROVAL_REQUIRED", message: "Only approved quotes can be sent." };
  }

  const sent: QuoteSnapshot = { ...quote, status: "SENT" };
  repository.updateQuoteStatus(quote.id, "SENT");
  return { ok: true, value: sent };
}
