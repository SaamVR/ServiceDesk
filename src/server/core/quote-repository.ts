import type { QuoteSnapshot, QuoteStatus } from "../../domain/quote";

export interface QuoteRow {
  id: string;
  workspace_id: string;
  request_id: string;
  version: number;
  status: QuoteStatus;
  service_code: QuoteSnapshot["serviceCode"];
  currency: string;
  subtotal_minor: number;
  tax_minor: number;
  total_minor: number;
  deposit_minor: number;
  balance_minor: number;
  duration_minutes: number;
  buffer_minutes: number;
  rate_version: string;
  valid_until: string;
  snapshot: QuoteSnapshot;
}

export interface QuoteTableError {
  message: string;
  code?: string;
}

export interface QuoteTableResult<T> {
  data: T | null;
  error: QuoteTableError | null;
}

export interface QuoteTableGateway {
  nextQuoteId(): string;
  findById(quoteId: string): Promise<QuoteTableResult<QuoteRow | null>>;
  findLatestByRequest(requestId: string): Promise<QuoteTableResult<QuoteRow | null>>;
  saveQuote(row: QuoteRow): Promise<QuoteTableResult<QuoteRow>>;
  supersedeQuote(quoteId: string): Promise<QuoteTableResult<null>>;
  updateQuoteStatus(quoteId: string, status: QuoteStatus): Promise<QuoteTableResult<null>>;
}

export function mapQuoteSnapshotToRow(quote: QuoteSnapshot): QuoteRow {
  return {
    id: quote.id,
    workspace_id: quote.workspaceId,
    request_id: quote.requestId,
    version: quote.version,
    status: quote.status,
    service_code: quote.serviceCode,
    currency: quote.currency,
    subtotal_minor: quote.subtotalMinor,
    tax_minor: quote.taxMinor,
    total_minor: quote.totalMinor,
    deposit_minor: quote.depositMinor,
    balance_minor: quote.balanceMinor,
    duration_minutes: quote.durationMinutes,
    buffer_minutes: quote.bufferMinutes,
    rate_version: quote.rateVersion,
    valid_until: quote.validUntil,
    snapshot: quote,
  };
}

export function mapQuoteRowToSnapshot(row: QuoteRow): QuoteSnapshot {
  return {
    ...row.snapshot,
    id: row.id,
    workspaceId: row.workspace_id,
    requestId: row.request_id,
    version: row.version,
    status: row.status,
    serviceCode: row.service_code,
    currency: row.currency,
    subtotalMinor: row.subtotal_minor,
    taxMinor: row.tax_minor,
    totalMinor: row.total_minor,
    depositMinor: row.deposit_minor,
    balanceMinor: row.balance_minor,
    durationMinutes: row.duration_minutes,
    bufferMinutes: row.buffer_minutes,
    rateVersion: row.rate_version,
    validUntil: row.valid_until,
  };
}

export function createPostgresQuoteRepository(gateway: QuoteTableGateway) {
  return {
    nextQuoteId: () => gateway.nextQuoteId(),

    async findById(quoteId: string): Promise<QuoteSnapshot | undefined> {
      const result = await gateway.findById(quoteId);
      if (result.error) throw new Error(result.error.message);
      return result.data ? mapQuoteRowToSnapshot(result.data) : undefined;
    },

    async findLatestByRequest(requestId: string): Promise<QuoteSnapshot | undefined> {
      const result = await gateway.findLatestByRequest(requestId);
      if (result.error) throw new Error(result.error.message);
      return result.data ? mapQuoteRowToSnapshot(result.data) : undefined;
    },

    async saveQuote(quote: QuoteSnapshot): Promise<void> {
      const result = await gateway.saveQuote(mapQuoteSnapshotToRow(quote));
      if (result.error) throw new Error(result.error.message);
    },

    async supersedeQuote(quoteId: string): Promise<void> {
      const result = await gateway.supersedeQuote(quoteId);
      if (result.error) throw new Error(result.error.message);
    },

    async updateQuoteStatus(quoteId: string, status: QuoteStatus): Promise<void> {
      const result = await gateway.updateQuoteStatus(quoteId, status);
      if (result.error) throw new Error(result.error.message);
    },
  };
}
