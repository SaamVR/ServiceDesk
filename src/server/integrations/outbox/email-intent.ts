import type { Result } from "../../../contracts";
import type { ClaimedOutboxEvent } from "../../../contracts/outbox";
import type { DeliveryPurpose, HandoverGuard, OutboxJob, RecipientPolicy } from "../types";
import type { TransactionalEmailPolicy } from "../email/adapter";

export type AuthoritativeEmailTopic =
  | "email.quote"
  | "email.confirmation"
  | "visit.reminder"
  | "email.invoice"
  | "email.feedback"
  | "conversation.reply";

export interface AuthoritativeEmailRecipient {
  recipientRef: string;
  to: string;
  consentRequired: boolean;
  hasOptIn: boolean;
  optedOut: boolean;
  hardBounced?: boolean;
  quietHoursBlocked?: boolean;
}

export interface AuthoritativeEmailIntent {
  eventId: string;
  workspaceId: string;
  topic: AuthoritativeEmailTopic;
  purpose: Extract<DeliveryPurpose, "QUOTE" | "CONFIRMATION" | "VISIT_REMINDER" | "INVOICE" | "FEEDBACK" | "CUSTOMER_REPLY">;
  recipient: AuthoritativeEmailRecipient;
  subject: string;
  text: string;
  html: string;
  templateKey?: string;
  policy?: TransactionalEmailPolicy;
  handoverGuard?: HandoverGuard;
  idempotencyKey: string;
  linkage?: Record<string, string>;
}

export interface AuthoritativeEmailIntentResolver {
  resolve(event: ClaimedOutboxEvent): Promise<Result<AuthoritativeEmailIntent>>;
}

function nonblank(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function expectedPurpose(topic: string): AuthoritativeEmailIntent["purpose"] | undefined {
  if (topic === "email.quote") return "QUOTE";
  if (topic === "email.confirmation") return "CONFIRMATION";
  if (topic === "visit.reminder") return "VISIT_REMINDER";
  if (topic === "email.invoice") return "INVOICE";
  if (topic === "email.feedback") return "FEEDBACK";
  if (topic === "conversation.reply") return "CUSTOMER_REPLY";
  return undefined;
}

function providerRecipientPolicy(intent: AuthoritativeEmailIntent): RecipientPolicy {
  return {
    recipientRef: intent.recipient.recipientRef,
    consentRequired: intent.recipient.consentRequired,
    hasOptIn: intent.recipient.hasOptIn,
    optedOut: intent.recipient.optedOut || intent.recipient.hardBounced === true,
    quietHoursBlocked: intent.recipient.quietHoursBlocked,
  };
}

function validateAuthoritativeEmailIntent(event: ClaimedOutboxEvent, intent: AuthoritativeEmailIntent): Result<true> {
  const expected = expectedPurpose(event.topic);
  if (!expected) {
    return { ok: false, code: "UNSUPPORTED_EMAIL_OUTBOX_TOPIC", message: "Unsupported authoritative email outbox topic." };
  }
  if (intent.eventId !== event.id || intent.workspaceId !== event.workspaceId || intent.topic !== event.topic || intent.purpose !== expected) {
    return { ok: false, code: "EMAIL_INTENT_IDENTITY_MISMATCH", message: "Authoritative email intent did not match claimed outbox identity." };
  }
  if (!nonblank(intent.idempotencyKey) || intent.idempotencyKey !== event.idempotencyKey) {
    return { ok: false, code: "EMAIL_INTENT_IDEMPOTENCY_MISMATCH", message: "Authoritative email intent idempotency must match the claimed outbox event." };
  }
  if (!nonblank(intent.recipient.recipientRef) || !nonblank(intent.recipient.to)) {
    return { ok: false, code: "EMAIL_RECIPIENT_INVALID", message: "Authoritative email recipient is required." };
  }
  if (!nonblank(intent.subject) || !nonblank(intent.text) || !nonblank(intent.html)) {
    return { ok: false, code: "EMAIL_CONTENT_INVALID", message: "Authoritative email subject, text and html are required." };
  }
  return { ok: true, value: true };
}

export async function resolveAuthoritativeEmailOutboxIntent(
  event: ClaimedOutboxEvent,
  resolver: AuthoritativeEmailIntentResolver,
): Promise<Result<OutboxJob>> {
  const resolved = await resolver.resolve(event);
  if (!resolved.ok) return resolved;

  const intent = resolved.value;
  const valid = validateAuthoritativeEmailIntent(event, intent);
  if (!valid.ok) return valid;

  return {
    ok: true,
    value: {
      id: event.id,
      workspaceId: intent.workspaceId,
      channel: "EMAIL",
      purpose: intent.purpose,
      recipient: providerRecipientPolicy(intent),
      createdAt: event.claimedAt,
      idempotencyKey: intent.idempotencyKey,
      handoverGuard: intent.handoverGuard,
      templateKey: intent.templateKey,
      freeformText: intent.purpose === "CUSTOMER_REPLY" ? intent.text : undefined,
      payload: {
        email: {
          to: intent.recipient.to,
          subject: intent.subject,
          text: intent.text,
          html: intent.html,
          policy: {
            ...(intent.policy ?? {}),
            optedOut: intent.recipient.optedOut,
            hardBounced: intent.recipient.hardBounced,
            handoverOpen: intent.handoverGuard?.handoverActive,
          },
          linkage: intent.linkage ?? {},
          authoritative: true,
        },
      },
    },
  };
}
