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

  if (new Date(meta.now).getTime() > new Date(quote.validUntil).getTime()) {
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
