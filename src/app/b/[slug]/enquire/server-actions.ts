import type { QuoteDTO, RequestDTO } from "@/contracts";
import {
  createEnquiryServerActionFactory,
  type EnquiryCommandPort,
  type EnquiryServerActionInput,
  type ProductActionResult,
} from "@/features/operations/server-action-adapters";

export type BusinessEnquiryServerActionInput = EnquiryServerActionInput;
export type BusinessEnquiryServerActionResult = ProductActionResult<{
  request: RequestDTO;
  quote: QuoteDTO;
}>;

export interface BusinessEnquiryServerCommands extends EnquiryCommandPort {}

export function createBusinessEnquiryServerActionFactory(commands: BusinessEnquiryServerCommands) {
  return createEnquiryServerActionFactory(commands);
}
