import type { ActorContext, CommandMeta, RequestDTO } from "../../contracts";
import type { CreateRequestInput, FindSlotsInput, VerifiedPaymentEvent } from "./facade";
import { createPaymentApplicationFacadeMethods, type PaymentApplicationFacadeDependencies } from "./payment-application-facade";
import { readPropertySnapshot, type PropertyReadRepository } from "./property-read";
import { createRequestQuoteFacadeMethods, type RequestQuoteFacadeDependencies } from "./request-quote-facade";

export type ServerEntrypointDependencies = RequestQuoteFacadeDependencies & PaymentApplicationFacadeDependencies & {
  propertyRepository: PropertyReadRepository;
};

export function createServerCommandEntrypoints(deps: ServerEntrypointDependencies) {
  const requestQuoteFacade = createRequestQuoteFacadeMethods(deps);
  const paymentFacade = createPaymentApplicationFacadeMethods(deps);
  return {
    createRequestCommand: (ctx: ActorContext, input: CreateRequestInput, meta: CommandMeta) => requestQuoteFacade.createRequest(ctx, input, meta),
    updateRequestCommand: (ctx: ActorContext, requestId: string, patch: Partial<RequestDTO>, meta: CommandMeta) => requestQuoteFacade.updateRequest(ctx, requestId, patch, meta),
    calculateQuoteCommand: (ctx: ActorContext, requestId: string) => requestQuoteFacade.calculateQuote(ctx, requestId),
    sendQuoteCommand: (ctx: ActorContext, quoteId: string, meta: CommandMeta) => requestQuoteFacade.sendQuote(ctx, quoteId, meta),
    findSlotsCommand: (ctx: ActorContext, input: FindSlotsInput) => requestQuoteFacade.findSlots(ctx, input),
    holdSlotCommand: (ctx: ActorContext, slotId: string, quoteId: string, meta: CommandMeta) => requestQuoteFacade.holdSlot(ctx, slotId, quoteId, meta),
    applyVerifiedPaymentCommand: (event: VerifiedPaymentEvent) => paymentFacade.applyVerifiedPayment(event),
    readPropertySnapshotCommand: (ctx: ActorContext, customerId: string) => readPropertySnapshot(ctx, customerId, deps.propertyRepository),
  };
}
