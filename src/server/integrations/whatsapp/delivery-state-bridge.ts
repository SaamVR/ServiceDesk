import type { MessageDeliveryState } from "../../../contracts";
import {
  decideWhatsAppStatusTransition,
  type WhatsAppDeliverySnapshot,
  type WhatsAppStatusTransitionDecision,
} from "./status-transition";

export type WhatsAppBusinessDeliveryState = Extract<MessageDeliveryState, "PROVIDER_ACCEPTED" | "DELIVERED" | "READ" | "FAILED">;

export interface WhatsAppBusinessDeliveryUpdateCommand {
  workspaceId: string;
  messageId: string;
  providerMessageId: string;
  deliveryState: WhatsAppBusinessDeliveryState;
  providerTimestamp: string;
  callbackKey: string;
  transitionReason: WhatsAppStatusTransitionDecision["reason"];
}

export interface WhatsAppDeliveryStateBridgeInput {
  workspaceId: string;
  messageId: string;
  providerMessageId: string;
  current?: WhatsAppDeliverySnapshot;
  incoming: WhatsAppDeliverySnapshot;
}

export interface WhatsAppDeliveryStateBridgeResult {
  decision: WhatsAppStatusTransitionDecision;
  command?: WhatsAppBusinessDeliveryUpdateCommand;
}

export function buildWhatsAppDeliveryStateUpdate(input: WhatsAppDeliveryStateBridgeInput): WhatsAppDeliveryStateBridgeResult {
  const decision = decideWhatsAppStatusTransition(input.current, input.incoming);
  if (decision.result !== "APPLY") return { decision };

  return {
    decision,
    command: {
      workspaceId: input.workspaceId,
      messageId: input.messageId,
      providerMessageId: input.providerMessageId,
      deliveryState: decision.nextState,
      providerTimestamp: input.incoming.providerTimestamp,
      callbackKey: input.incoming.callbackKey,
      transitionReason: decision.reason,
    },
  };
}
