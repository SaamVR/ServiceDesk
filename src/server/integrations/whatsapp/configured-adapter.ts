import type { ActorContext, CommandMeta, Result } from "../../../contracts";
import type { OutboxJob, ProviderMode, ProviderSendResult, RedactedProviderEvidence } from "../types";
import { sendWhatsAppCloudMessage, type WhatsAppCloudApiConfig, type WhatsAppCloudHttpTransport, type WhatsAppCloudMessage } from "./cloud-api";
import { prepareWhatsAppDispatch } from "./outbound-policy";

export interface ConfiguredWhatsAppCloudAdapterConfig extends WhatsAppCloudApiConfig {
  templateLanguageCode?: string;
  mode?: ProviderMode;
  now?: () => string;
}

function providerEvidence(input: {
  providerMessageId: string;
  mode: ProviderMode;
  capturedAt: string;
  idempotencyKey: string;
}): RedactedProviderEvidence {
  return {
    provider: "WHATSAPP",
    mode: input.mode,
    verification: "CONTRACT_TESTED",
    capturedAt: input.capturedAt,
    controlledId: input.providerMessageId,
    notes: [
      "Provider acceptance only; delivery/read/failure status requires a separate signed WhatsApp status callback.",
      `Outbox idempotency key ${input.idempotencyKey} was preserved for provider dispatch dedupe.`,
      "Access token, recipient phone, free-form body, and raw provider payload are intentionally omitted from evidence.",
    ],
  };
}

function messageFromJob(job: OutboxJob, requiresTemplate: boolean, templateLanguageCode: string): Result<WhatsAppCloudMessage> {
  const mediaId = typeof job.payload.mediaId === "string" ? job.payload.mediaId : undefined;

  if (requiresTemplate) {
    if (!job.templateKey) {
      return { ok: false, code: "WHATSAPP_TEMPLATE_REQUIRED", message: "WhatsApp template key is required outside the customer-service window." };
    }
    const languageCode = typeof job.payload.templateLanguageCode === "string" ? job.payload.templateLanguageCode : templateLanguageCode;
    return { ok: true, value: { to: job.recipient.recipientRef, kind: "template", templateName: job.templateKey, languageCode } };
  }

  if (mediaId) {
    return { ok: true, value: { to: job.recipient.recipientRef, kind: "image", mediaId } };
  }

  if (!job.freeformText) {
    return { ok: false, code: "WHATSAPP_MESSAGE_BODY_REQUIRED", message: "WhatsApp in-window dispatch requires free-form text or a media ID." };
  }

  return { ok: true, value: { to: job.recipient.recipientRef, kind: "text", text: job.freeformText } };
}

export async function sendConfiguredWhatsAppCloudMessage(
  ctx: ActorContext,
  job: OutboxJob,
  meta: CommandMeta,
  config: ConfiguredWhatsAppCloudAdapterConfig,
  http: WhatsAppCloudHttpTransport,
): Promise<Result<ProviderSendResult>> {
  const prepared = prepareWhatsAppDispatch(ctx, job, meta);
  if (!prepared.ok) return prepared;

  const message = messageFromJob(job, prepared.value.policy.requiresTemplate, config.templateLanguageCode ?? "en_US");
  if (!message.ok) return message;

  const sent = await sendWhatsAppCloudMessage(config, message.value, http);
  if (!sent.ok) return sent;

  const acceptedAt = config.now?.() ?? meta.now;
  const mode = config.mode ?? "SANDBOX";

  return {
    ok: true,
    value: {
      jobId: job.id,
      providerMessageId: sent.value.providerMessageId,
      acceptedAt,
      mode,
      evidence: providerEvidence({
        providerMessageId: sent.value.providerMessageId,
        mode,
        capturedAt: acceptedAt,
        idempotencyKey: prepared.value.dispatch.idempotencyKey,
      }),
    },
  };
}
