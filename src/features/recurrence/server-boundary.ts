import type { ActorContext, CommandMeta, RecurrenceRuleDTO, Result } from "@/contracts";
import type { CreateRecurrenceRuleInput, RecurrenceRuleAction } from "@/server/core/facade";
import type { ProductActionError } from "@/features/operations/action-state";
import {
  productActionFailure,
  productActionSuccess,
  type ProductActionResult,
} from "@/features/operations/server-action-adapters";

export interface RecurrenceCommandPort {
  createRecurrenceRule(ctx: ActorContext, input: CreateRecurrenceRuleInput, meta: CommandMeta): Promise<Result<RecurrenceRuleDTO>>;
  applyRecurrenceRuleAction(ctx: ActorContext, id: string, action: RecurrenceRuleAction, meta: CommandMeta): Promise<Result<RecurrenceRuleDTO>>;
}

export interface CreateRecurrenceRuleServerActionInput {
  ctx: ActorContext;
  input: CreateRecurrenceRuleInput;
  meta: CommandMeta;
}

export interface ApplyRecurrenceRuleServerActionInput {
  ctx: ActorContext;
  rule: RecurrenceRuleDTO;
  action: RecurrenceRuleAction;
  idempotencyKey: string;
  now: string;
}

function productErrorFromResult(result: Extract<Result<never>, { ok: false }>): ProductActionError {
  return { code: result.code, message: result.message };
}

function toProductActionResult<T>(result: Result<T>, steps: string[], failedStep: string, successMessage: string): ProductActionResult<T> {
  if (result.ok) {
    return productActionSuccess(result.value, steps, successMessage);
  }
  return productActionFailure(productErrorFromResult(result as Extract<Result<never>, { ok: false }>), steps, failedStep);
}

export function createRecurrenceServerActionFactory(commands: RecurrenceCommandPort) {
  return {
    async createRule(input: CreateRecurrenceRuleServerActionInput): Promise<ProductActionResult<RecurrenceRuleDTO>> {
      const steps = ["createRecurrenceRule"];
      const result = await commands.createRecurrenceRule(input.ctx, input.input, input.meta);
      return toProductActionResult(result, steps, "createRecurrenceRule", "Recurrence rule created by server command.");
    },

    async applyAction(input: ApplyRecurrenceRuleServerActionInput): Promise<ProductActionResult<RecurrenceRuleDTO>> {
      const steps = ["applyRecurrenceRuleAction"];
      const meta: CommandMeta = {
        idempotencyKey: input.idempotencyKey,
        expectedVersion: input.rule.version,
        now: input.now,
      };
      const result = await commands.applyRecurrenceRuleAction(input.ctx, input.rule.id, input.action, meta);
      return toProductActionResult(result, steps, "applyRecurrenceRuleAction", "Recurrence rule action accepted by server command.");
    },
  };
}
