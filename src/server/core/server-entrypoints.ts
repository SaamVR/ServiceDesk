import type { ActorContext, CommandMeta, RequestDTO } from "../../contracts";
import type { CreateRequestInput, FindSlotsInput } from "./facade";
import { readPropertySnapshot, type PropertyReadRepository } from "./property-read";
import { createRequestQuoteFacadeMethods, type RequestQuoteFacadeDependencies } from "./request-quote-facade";

export interface ServerEntrypointDependencies extends RequestQuoteFacadeDependencies {
  propertyRepository: PropertyReadRepository;
}

export function createServerCommandEntrypoints(deps: ServerEntrypointDependencies) {
  const facade = createRequestQuoteFacadeMethods(deps);
  return {
    createRequestCommand: (ctx: ActorContext, input: CreateRequestInput, meta: CommandMeta) => facade.createRequest(ctx, input, meta),
    updateRequestCommand: (ctx: ActorContext, requestId: string, patch: Partial<RequestDTO>, meta: CommandMeta) => facade.updateRequest(ctx, requestId, patch, meta),
    calculateQuoteCommand: (ctx: ActorContext, requestId: string) => facade.calculateQuote(ctx, requestId),
    sendQuoteCommand: (ctx: ActorContext, quoteId: string, meta: CommandMeta) => facade.sendQuote(ctx, quoteId, meta),
    findSlotsCommand: (ctx: ActorContext, input: FindSlotsInput) => facade.findSlots(ctx, input),
    holdSlotCommand: (ctx: ActorContext, slotId: string, quoteId: string, meta: CommandMeta) => facade.holdSlot(ctx, slotId, quoteId, meta),
    readPropertySnapshotCommand: (ctx: ActorContext, customerId: string) => readPropertySnapshot(ctx, customerId, deps.propertyRepository),
  };
}
