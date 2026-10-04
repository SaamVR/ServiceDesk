import type { Result } from "../../../contracts";
import { applyEmailCallbackLifecycle, summarizeEmailCallback, type EmailCallbackLifecycleEvent, type EmailCallbackLifecycleSnapshot } from "./lifecycle";
import { classifyEmailCallbackPolicy } from "./callback-policy";
import type { EmailCallbackReceiptStore } from "./callback-receipt";

export type EmailCoreDeliveryState = "DELIVERED" | "RETRYABLE_FAILURE" | "FAILED";

export interface NormalizedEmailProviderCallback extends EmailCallbackLifecycleEvent {
  recipientRef: string;
  rawProviderEventRef?: string;
}

export interface EmailDeliveryStateCommand {
  command: "UPDATE_MESSAGE_DELIVERY_STATE";
  providerMessageId: string;
  deliveryState: EmailCoreDeliveryState;
  occurredAt: string;
  evidenceRef?: string;
  providerAcceptedIsDelivered: false;
}

export interface EmailSuppressionReviewCommand {
  command: "REVIEW_OR_SUPPRESS_RECIPIENT";
  providerMessageId: string;
  redactedRecipientRef: string;
  reason: "HARD_BOUNCE" | "UNKNOWN_BOUNCE" | "COMPLAINT";
  occurredAt: string;
}

export interface EmailCallbackCoreCommandPort {
  applyDeliveryState(command: EmailDeliveryStateCommand): Promise<Result<"APPLIED" | "DUPLICATE">>;
  applySuppressionReview(command: EmailSuppressionReviewCommand): Promise<Result<"APPLIED" | "DUPLICATE">>;
}

export interface EmailCallbackProcessingResult {
  receipt: "INSERTED" | "DUPLICATE";
  deliveryCommand?: EmailDeliveryStateCommand;
  suppressionCommand?: EmailSuppressionReviewCommand;
  deliveryResult?: "APPLIED" | "DUPLICATE";
  suppressionResult?: "APPLIED" | "DUPLICATE";
  acknowledged: boolean;
  retryable: boolean;
}

function deliveryState(event: EmailCallbackLifecycleEvent): EmailCoreDeliveryState {
  if (event.eventType === "DELIVERED") return "DELIVERED";
  if (event.eventType === "BOUNCE" && event.bounceType === "soft") return "RETRYABLE_FAILURE";
  return "FAILED";
}

function suppressionReason(event: EmailCallbackLifecycleEvent): EmailSuppressionReviewCommand["reason"] | undefined {
  if (event.eventType === "COMPLAINT") return "COMPLAINT";
  if (event.eventType === "BOUNCE" && event.bounceType === "hard") return "HARD_BOUNCE";
  if (event.eventType === "BOUNCE" && event.bounceType === "unknown") return "UNKNOWN_BOUNCE";
  return undefined;
}

export function buildEmailCallbackCommands(
  current: EmailCallbackLifecycleSnapshot | undefined,
  event: NormalizedEmailProviderCallback,
): { deliveryCommand?: EmailDeliveryStateCommand; suppressionCommand?: EmailSuppressionReviewCommand } {
  const decision = applyEmailCallbackLifecycle(current, event);
  if (decision.result === "DUPLICATE" || decision.result === "OUT_OF_ORDER_IGNORED") return {};

  const summary = summarizeEmailCallback({
    providerMessageId: event.providerMessageId,
    recipientRef: event.recipientRef,
    eventType: event.eventType,
    bounceType: event.bounceType,
  });
  const redactedRecipientRef = summary.recipientRef.includes("@") ? summary.recipientRef.replace(/^[^@]+/, "redacted") : "recipient:redacted";
  const policy = classifyEmailCallbackPolicy({ eventType: event.eventType, bounceType: event.bounceType });
  const suppression = suppressionReason(event);

  return {
    deliveryCommand: {
      command: "UPDATE_MESSAGE_DELIVERY_STATE",
      providerMessageId: event.providerMessageId,
      deliveryState: deliveryState(event),
      occurredAt: event.occurredAt,
      evidenceRef: event.rawProviderEventRef,
      providerAcceptedIsDelivered: false,
    },
    suppressionCommand: suppression || policy.suppressionAction === "SUPPRESS_RECIPIENT"
      ? {
          command: "REVIEW_OR_SUPPRESS_RECIPIENT",
          providerMessageId: event.providerMessageId,
          redactedRecipientRef,
          reason: suppression ?? "UNKNOWN_BOUNCE",
          occurredAt: event.occurredAt,
        }
      : undefined,
  };
}

export async function processEmailProviderCallback(input: {
  event: NormalizedEmailProviderCallback;
  current?: EmailCallbackLifecycleSnapshot;
  receiptStore: EmailCallbackReceiptStore;
  core: EmailCallbackCoreCommandPort;
}): Promise<Result<EmailCallbackProcessingResult>> {
  const receipt = await input.receiptStore.persist(input.event);
  const commands = buildEmailCallbackCommands(input.current, input.event);
  const result: EmailCallbackProcessingResult = { receipt, ...commands, acknowledged: true, retryable: false };

  if (commands.deliveryCommand) {
    const applied = await input.core.applyDeliveryState(commands.deliveryCommand);
    if (!applied.ok) return { ok: false, code: applied.code, message: applied.message };
    result.deliveryResult = applied.value;
  }

  if (commands.suppressionCommand) {
    const applied = await input.core.applySuppressionReview(commands.suppressionCommand);
    if (!applied.ok) return { ok: false, code: applied.code, message: applied.message };
    result.suppressionResult = applied.value;
  }

  return { ok: true, value: result };
}
