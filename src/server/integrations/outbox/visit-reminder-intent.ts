import type { Result, VisitDTO } from "../../../contracts";
import type { ClaimedOutboxEvent } from "../../../contracts/outbox";
import type { DeliveryChannel, OutboxJob, RecipientPolicy } from "../types";

export interface VisitReminderMessage {
  body: string;
  templateKey?: string;
  templateData?: Record<string, unknown>;
  subject?: string;
  text?: string;
  html?: string;
  lastInboundAt?: string;
}

export interface VisitReminderAuthoritativeSource {
  eventId: string;
  workspaceId: string;
  reminderId: string;
  visit: VisitDTO;
  customerId?: string;
  conversationId?: string;
  expectedConversationVersion?: number;
  channel: Extract<DeliveryChannel, "WHATSAPP" | "EMAIL">;
  recipient: RecipientPolicy & { hardBounced?: boolean };
  handoverActive: boolean;
  message: VisitReminderMessage;
  idempotencyKey: string;
}

export interface VisitReminderAuthoritativeSourcePort {
  load(event: ClaimedOutboxEvent): Promise<Result<VisitReminderAuthoritativeSource>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function nonblank(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertValidSource(event: ClaimedOutboxEvent, source: VisitReminderAuthoritativeSource): Result<true> {
  if (event.topic !== "visit.reminder") {
    return { ok: false, code: "UNSUPPORTED_VISIT_REMINDER_TOPIC", message: "Only visit.reminder outbox events are supported." };
  }
  if (source.eventId !== event.id || source.workspaceId !== event.workspaceId || source.visit.workspaceId !== event.workspaceId) {
    return { ok: false, code: "VISIT_REMINDER_IDENTITY_MISMATCH", message: "Authoritative reminder source did not match claimed outbox identity." };
  }
  if (!nonblank(source.reminderId) || !nonblank(source.visit.id) || !nonblank(source.idempotencyKey)) {
    return { ok: false, code: "VISIT_REMINDER_IDENTITY_INVALID", message: "Reminder ID, visit ID and idempotency key are required." };
  }
  if (source.channel !== "WHATSAPP" && source.channel !== "EMAIL") {
    return { ok: false, code: "VISIT_REMINDER_CHANNEL_UNSUPPORTED", message: "Visit reminders support only WhatsApp and Email channels." };
  }
  if (!nonblank(source.recipient.recipientRef)) {
    return { ok: false, code: "VISIT_REMINDER_RECIPIENT_MISSING", message: "Reminder recipient must come from authoritative server source." };
  }
  if (!nonblank(source.message.body)) {
    return { ok: false, code: "VISIT_REMINDER_BODY_MISSING", message: "Reminder body/template data must come from authoritative server source." };
  }
  return { ok: true, value: true };
}

export function buildVisitReminderOutboxJob(event: ClaimedOutboxEvent, source: VisitReminderAuthoritativeSource): Result<OutboxJob> {
  const valid = assertValidSource(event, source);
  if (!valid.ok) return valid;

  const payload = source.channel === "EMAIL"
    ? {
        reminder: { reminderId: source.reminderId, visitId: source.visit.id, customerId: source.customerId, channel: source.channel },
        email: {
          to: source.recipient.recipientRef,
          subject: source.message.subject ?? "Upcoming service visit reminder",
          text: source.message.text ?? source.message.body,
          html: source.message.html ?? source.message.body,
          policy: {
            optedOut: source.recipient.optedOut,
            hardBounced: source.recipient.hardBounced,
            handoverOpen: source.handoverActive,
          },
        },
      }
    : {
        reminder: { reminderId: source.reminderId, visitId: source.visit.id, customerId: source.customerId, channel: source.channel },
        whatsapp: {
          body: source.message.body,
          templateData: source.message.templateData,
          lastInboundAt: source.message.lastInboundAt,
        },
        lastInboundAt: source.message.lastInboundAt,
      };

  return {
    ok: true,
    value: {
      id: event.id,
      workspaceId: source.workspaceId,
      channel: source.channel,
      purpose: "VISIT_REMINDER",
      recipient: {
        recipientRef: source.recipient.recipientRef,
        consentRequired: source.recipient.consentRequired,
        hasOptIn: source.recipient.hasOptIn,
        optedOut: source.recipient.optedOut,
        quietHoursBlocked: source.recipient.quietHoursBlocked,
      },
      createdAt: event.claimedAt,
      idempotencyKey: source.idempotencyKey,
      handoverGuard: source.conversationId ? {
        conversationId: source.conversationId,
        expectedConversationVersion: source.expectedConversationVersion ?? source.visit.version,
        handoverActive: source.handoverActive,
      } : undefined,
      templateKey: source.message.templateKey,
      freeformText: source.channel === "WHATSAPP" ? source.message.body : undefined,
      payload,
    },
  };
}

export async function resolveVisitReminderOutboxIntent(
  event: ClaimedOutboxEvent,
  source: VisitReminderAuthoritativeSourcePort,
): Promise<Result<OutboxJob>> {
  const payload = isRecord(event.payload) ? event.payload : {};
  const payloadReminderId = stringField(payload, "reminderId");
  const payloadVisitId = stringField(payload, "visitId");

  const loaded = await source.load(event);
  if (!loaded.ok) return loaded;
  const built = buildVisitReminderOutboxJob(event, loaded.value);
  if (!built.ok) return built;
  if (payloadReminderId && payloadReminderId !== loaded.value.reminderId) {
    return { ok: false, code: "VISIT_REMINDER_IDENTITY_MISMATCH", message: "Claimed reminder ID does not match authoritative source." };
  }
  if (payloadVisitId && payloadVisitId !== loaded.value.visit.id) {
    return { ok: false, code: "VISIT_REMINDER_VISIT_MISMATCH", message: "Claimed visit ID does not match authoritative source." };
  }
  return built;
}
