import type { ClaimedOutboxEvent, Result } from "../../../contracts";
import type { SupabaseRpcClient } from "../../core/payment-application-postgres";
import type { OutboxJob } from "../types";
import type { OutboxDeliveryIntentResolver } from "./intent-resolver";

type Row = Record<string, unknown>;

function fail(code: string, message: string): Result<OutboxJob> {
  return { ok: false, code, message };
}

function requiredText(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Malformed retention campaign intent: ${key}`);
  return value;
}

function optionalText(row: Row, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function createRetentionCampaignIntentResolver(
  client: SupabaseRpcClient,
  now: () => string = () => new Date().toISOString(),
): OutboxDeliveryIntentResolver {
  return {
    async resolve(event) {
      if (event.topic !== "retention.campaign") {
        return fail("OUTBOX_TOPIC_UNSUPPORTED", "Retention campaign resolver only accepts retention.campaign events.");
      }

      const { data, error } = await client.rpc<Row>(
        "servicedesk_resolve_retention_campaign_intent",
        {
          p_input: {
            workspaceId: event.workspaceId,
            eventId: event.id,
            now: now(),
          },
        },
      );
      if (error) {
        return fail(error.code ?? "RETENTION_INTENT_RPC_ERROR", "Retention campaign intent could not be resolved.");
      }
      if (!data || data.ok !== true) {
        return fail(String(data?.code ?? "RETENTION_INTENT_RPC_REJECTED"), "Retention campaign intent was rejected.");
      }
      if (data.allowed !== true) {
        return fail(String(data.code ?? "RETENTION_CAMPAIGN_SUPPRESSED"), "Retention campaign is no longer eligible.");
      }

      try {
        const eventId = requiredText(data, "eventId");
        const workspaceId = requiredText(data, "workspaceId");
        const idempotencyKey = requiredText(data, "idempotencyKey");
        const recipientRef = requiredText(data, "recipientRef");
        const channel = requiredText(data, "channel");
        const campaignId = requiredText(data, "campaignId");
        const customerId = requiredText(data, "customerId");
        const campaignPurpose = requiredText(data, "campaignPurpose");
        const text = requiredText(data, "text");
        const subject = optionalText(data, "subject");
        const html = optionalText(data, "html");
        const templateKey = optionalText(data, "templateKey");

        if (eventId !== event.id || workspaceId !== event.workspaceId || idempotencyKey !== event.idempotencyKey) {
          return fail("RETENTION_INTENT_IDENTITY_MISMATCH", "Resolved campaign intent did not match the claimed outbox event.");
        }
        if (channel !== "EMAIL" && channel !== "WHATSAPP") {
          return fail("RETENTION_INTENT_CHANNEL_INVALID", "Retention campaign channel is unsupported.");
        }
        if (String(event.payload.campaignId ?? "") !== campaignId
            || String(event.payload.customerId ?? "") !== customerId
            || String(event.payload.channel ?? "") !== channel) {
          return fail("RETENTION_INTENT_PAYLOAD_MISMATCH", "Resolved campaign intent did not match queued identifiers.");
        }
        if (channel === "EMAIL" && (!subject || !html)) {
          return fail("RETENTION_EMAIL_CONTENT_INVALID", "Retention campaign email requires subject and html content.");
        }

        const payload: Record<string, unknown> = channel === "EMAIL"
          ? {
              campaignId,
              customerId,
              campaignPurpose,
              email: {
                to: recipientRef,
                subject,
                text,
                html,
                policy: {
                  optedOut: false,
                  hardBounced: false,
                  handoverOpen: false,
                },
              },
            }
          : { campaignId, customerId, campaignPurpose, text };

        return {
          ok: true,
          value: {
            id: event.id,
            workspaceId,
            channel,
            purpose: "RETENTION_CAMPAIGN",
            recipient: {
              recipientRef,
              consentRequired: true,
              hasOptIn: true,
              optedOut: false,
              quietHoursBlocked: false,
            },
            createdAt: event.claimedAt,
            idempotencyKey,
            templateKey,
            freeformText: channel === "WHATSAPP" ? text : undefined,
            payload,
          },
        };
      } catch (error) {
        return fail(
          "RETENTION_INTENT_MALFORMED",
          error instanceof Error ? error.message : "Malformed retention campaign intent.",
        );
      }
    },
  };
}
