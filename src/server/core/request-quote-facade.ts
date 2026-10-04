import { createCapacityFacadeMethods, type CapacityFacadeDependencies } from "./capacity-facade";
import type { ServiceDeskFacade } from "./facade";
import { createQuoteFacadeMethods, type QuoteFacadeDependencies } from "./quote-facade";
import { createRequestFacadeMethods, type RequestFacadeDependencies } from "./request-facade";

export type RequestQuoteCapacityFacade = Pick<
  ServiceDeskFacade,
  "createRequest" | "updateRequest" | "calculateQuote" | "sendQuote" | "findSlots" | "holdSlot"
>;

export interface RequestQuoteFacadeDependencies extends RequestFacadeDependencies, QuoteFacadeDependencies, CapacityFacadeDependencies {}

export function createRequestQuoteFacadeMethods(deps: RequestQuoteFacadeDependencies): RequestQuoteCapacityFacade {
  return {
    ...createRequestFacadeMethods(deps),
    ...createQuoteFacadeMethods(deps),
    ...createCapacityFacadeMethods(deps),
  };
}
