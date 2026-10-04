import type { ActorContext, CommandMeta, QuoteDTO, Result } from "../../contracts";
import type { QuoteServiceCode, QuoteSnapshot } from "../../domain/quote";
import { requireActiveStaffContext, requireRole, requireWorkspace } from "./auth";
import type { ServiceDeskFacade } from "./facade";
import { createQuoteDraftWithRepository, sendQuoteByIdWithRepository, type QuoteRepository } from "./quotes";
import type { RequestRecord, RequestRepository } from "./requests";

export interface QuoteFacadeDependencies {
  requestRepository: Pick<RequestRepository, "findById">;
  quoteRepository: QuoteRepository;
  now: () => string;
}

function quoteToDTO(quote: QuoteSnapshot): QuoteDTO {
  return {
    id: quote.id,
    workspaceId: quote.workspaceId,
    requestId: quote.requestId,
    version: quote.version,
    status: quote.status,
    currency: quote.currency,
    subtotalMinor: quote.subtotalMinor,
    taxMinor: quote.taxMinor,
    totalMinor: quote.totalMinor,
    depositMinor: quote.depositMinor,
    balanceMinor: quote.balanceMinor,
    durationMinutes: quote.durationMinutes,
    bufferMinutes: quote.bufferMinutes,
    rateVersion: quote.rateVersion,
    validUntil: quote.validUntil,
  };
}

function isQuoteServiceCode(value: string | undefined): value is QuoteServiceCode {
  return value === "MOVE_OUT" || value === "STANDARD" || value === "DEEP";
}

function authorizeQuoteCalculation(ctx: ActorContext, request: Pick<RequestRecord, "workspaceId" | "visitorSessionId">): Result<true> {
  const workspace = requireWorkspace(ctx, request.workspaceId);
  if (workspace.ok === false) return workspace;

  if (ctx.role === "VISITOR") {
    if (ctx.visitorSessionId && request.visitorSessionId && ctx.visitorSessionId === request.visitorSessionId) {
      return { ok: true, value: true };
    }
    return { ok: false, code: "VISITOR_SCOPE_REQUIRED", message: "Visitor session cannot access this request." };
  }

  const staff = requireActiveStaffContext(ctx);
  if (staff.ok === false) return staff;
  return requireRole(ctx, ["OWNER", "DISPATCHER"]);
}

function authorizeQuoteSend(ctx: ActorContext, quote: Pick<QuoteSnapshot, "workspaceId">): Result<true> {
  const workspace = requireWorkspace(ctx, quote.workspaceId);
  if (workspace.ok === false) return workspace;

  const staff = requireActiveStaffContext(ctx);
  if (staff.ok === false) return staff;
  return requireRole(ctx, ["OWNER", "DISPATCHER"]);
}

function requestQuoteInput(request: RequestRecord): Result<{
  serviceCode: QuoteServiceCode;
  bedrooms: number;
  bathrooms: number;
}> {
  if (!isQuoteServiceCode(request.serviceCode)) {
    return { ok: false, code: "REQUEST_SERVICE_REQUIRED", message: "Request needs a supported service before quoting." };
  }

  if (request.bedrooms === undefined || request.bathrooms === undefined) {
    return { ok: false, code: "REQUEST_ROOMS_REQUIRED", message: "Request needs bedroom and bathroom counts before quoting." };
  }

  return {
    ok: true,
    value: {
      serviceCode: request.serviceCode,
      bedrooms: request.bedrooms,
      bathrooms: request.bathrooms,
    },
  };
}

export function createQuoteFacadeMethods(deps: QuoteFacadeDependencies): Pick<ServiceDeskFacade, "calculateQuote" | "sendQuote"> {
  return {
    async calculateQuote(ctx: ActorContext, requestId: string): Promise<Result<QuoteDTO>> {
      const requestResult = await deps.requestRepository.findById(ctx.workspaceId, requestId);
      if (requestResult.ok === false) return requestResult;

      const authorized = authorizeQuoteCalculation(ctx, requestResult.value);
      if (authorized.ok === false) return authorized;

      const input = requestQuoteInput(requestResult.value);
      if (input.ok === false) return input;

      const quote = await createQuoteDraftWithRepository(deps.quoteRepository, {
        workspaceId: requestResult.value.workspaceId,
        requestId: requestResult.value.id,
        serviceCode: input.value.serviceCode,
        bedrooms: input.value.bedrooms,
        bathrooms: input.value.bathrooms,
        oven: input.value.serviceCode === "MOVE_OUT",
        now: deps.now(),
      });
      if (quote.ok === false) return quote;

      return { ok: true, value: quoteToDTO(quote.value) };
    },

    async sendQuote(ctx: ActorContext, quoteId: string, meta: CommandMeta): Promise<Result<QuoteDTO>> {
      const quote = await deps.quoteRepository.findById(quoteId);
      if (!quote) return { ok: false, code: "QUOTE_NOT_FOUND", message: "No quote exists for this identifier." };

      const authorized = authorizeQuoteSend(ctx, quote);
      if (authorized.ok === false) return authorized;

      const sent = await sendQuoteByIdWithRepository(deps.quoteRepository, quoteId, meta);
      if (sent.ok === false) return sent;

      return { ok: true, value: quoteToDTO(sent.value) };
    },
  };
}
