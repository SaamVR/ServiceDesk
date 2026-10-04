import type { QuoteDTO, RequestDTO, SlotDTO } from "@/contracts";
import { mapProductActionError, successProductActionState, type ProductActionError, type ProductActionState } from "./action-state";

type CommandSuccess<T> = { ok: true; value: T };
type CommandFailure = { ok: false; error: ProductActionError };
type Result<T> = CommandSuccess<T> | CommandFailure;

export interface ProductActionContext {
  workspaceId: string;
  actorId: string;
  idempotencyKey: string;
}

export interface ProductActionResult<T> {
  ok: boolean;
  value?: T;
  error?: ProductActionError;
  state: ProductActionState;
  steps: string[];
  failedStep?: string;
}

export interface CreateRequestCommandInput {
  context: ProductActionContext;
  request: Record<string, unknown>;
}

export interface UpdateRequestCommandInput {
  context: ProductActionContext;
  requestId: string;
  expectedVersion: number;
  patch: Record<string, unknown>;
}

export interface CalculateQuoteCommandInput {
  context: ProductActionContext;
  requestId: string;
  requestVersion: number;
}

export interface SendQuoteCommandInput {
  context: ProductActionContext;
  quoteId: string;
  expectedVersion: number;
}

export interface FindSlotsCommandInput {
  context: ProductActionContext;
  requestId: string;
  quoteId: string;
}

export interface HoldSlotCommandInput {
  context: ProductActionContext;
  slotId: string;
  requestId: string;
  quoteId: string;
  expectedQuoteVersion: number;
}

export interface EnquiryCommandPort {
  createRequest(input: CreateRequestCommandInput): Promise<Result<RequestDTO>>;
  updateRequest(input: UpdateRequestCommandInput): Promise<Result<RequestDTO>>;
  calculateQuote(input: CalculateQuoteCommandInput): Promise<Result<QuoteDTO>>;
}

export interface QuoteCommandPort {
  sendQuote(input: SendQuoteCommandInput): Promise<Result<QuoteDTO>>;
}

export interface ScheduleCommandPort {
  findSlots(input: FindSlotsCommandInput): Promise<Result<SlotDTO[]>>;
  holdSlot(input: HoldSlotCommandInput): Promise<Result<SlotDTO>>;
}

export interface EnquiryServerActionInput {
  context: ProductActionContext;
  request: Record<string, unknown>;
  patch: Record<string, unknown>;
}

function isCommandSuccess<T>(result: Result<T>): result is CommandSuccess<T> {
  return result.ok === true;
}

function success<T>(value: T, steps: string[], message?: string): ProductActionResult<T> {
  return { ok: true, value, steps, state: successProductActionState(message) };
}

function failure<T>(error: ProductActionError, steps: string[], failedStep: string): ProductActionResult<T> {
  return { ok: false, error, steps, failedStep, state: mapProductActionError(error) };
}

export function createEnquiryServerActionFactory(commands: EnquiryCommandPort) {
  return async function submitEnquiry(input: EnquiryServerActionInput): Promise<ProductActionResult<{ request: RequestDTO; quote: QuoteDTO }>> {
    const steps: string[] = [];

    steps.push("createRequest");
    const created = await commands.createRequest({ context: input.context, request: input.request });
    if (!isCommandSuccess(created)) return failure(created.error, steps, "createRequest");

    steps.push("updateRequest");
    const updated = await commands.updateRequest({
      context: input.context,
      requestId: created.value.id,
      expectedVersion: created.value.version,
      patch: input.patch,
    });
    if (!isCommandSuccess(updated)) return failure(updated.error, steps, "updateRequest");

    steps.push("calculateQuote");
    const quoted = await commands.calculateQuote({
      context: input.context,
      requestId: updated.value.id,
      requestVersion: updated.value.version,
    });
    if (!isCommandSuccess(quoted)) return failure(quoted.error, steps, "calculateQuote");

    return success({ request: updated.value, quote: quoted.value }, steps, "Request and quote are ready from accepted server commands.");
  };
}

export function createSendQuoteServerActionFactory(commands: QuoteCommandPort) {
  return async function submitSendQuote(input: SendQuoteCommandInput): Promise<ProductActionResult<QuoteDTO>> {
    const result = await commands.sendQuote(input);
    return isCommandSuccess(result)
      ? success(result.value, ["sendQuote"], "Quote send command accepted.")
      : failure(result.error, ["sendQuote"], "sendQuote");
  };
}

export function createScheduleServerActionFactory(commands: ScheduleCommandPort) {
  return {
    async findSlots(input: FindSlotsCommandInput): Promise<ProductActionResult<SlotDTO[]>> {
      const result = await commands.findSlots(input);
      return isCommandSuccess(result)
        ? success(result.value, ["findSlots"], "Slots loaded from accepted server command.")
        : failure(result.error, ["findSlots"], "findSlots");
    },
    async holdSlot(input: HoldSlotCommandInput): Promise<ProductActionResult<SlotDTO>> {
      const result = await commands.holdSlot(input);
      return isCommandSuccess(result)
        ? success(result.value, ["holdSlot"], "Slot hold command accepted.")
        : failure(result.error, ["holdSlot"], "holdSlot");
    },
  };
}
