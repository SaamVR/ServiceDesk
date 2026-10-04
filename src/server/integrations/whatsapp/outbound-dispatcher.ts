import type { ActorContext, CommandMeta, Result } from "../../../contracts";
import type { OutboxJob, ProviderSendResult } from "../types";
import {
  sendConfiguredWhatsAppCloudMessage,
  type ConfiguredWhatsAppCloudAdapterConfig,
} from "./configured-adapter";
import type { WhatsAppCloudHttpTransport } from "./cloud-api";
import { prepareWhatsAppDispatch } from "./outbound-policy";
import { evaluateWhatsAppTemplateRegistration, type WhatsAppTemplateRegistryEntry } from "./template-registry";

export interface WhatsAppProviderAccountRegistration {
  workspaceId: string;
  providerAccountRef: string;
  phoneNumberId: string;
}

export type WhatsAppAcceptanceRecordStatus = "RECORDED" | "DUPLICATE";

export interface RecordWhatsAppProviderAcceptanceInput {
  job: OutboxJob;
  result: ProviderSendResult;
  idempotencyKey: string;
  recordedAt: string;
}

export interface WhatsAppOutboundDispatchStore {
  loadLatestOutboxJob(jobId: string): Promise<OutboxJob | null>;
  loadProviderAccount(workspaceId: string): Promise<WhatsAppProviderAccountRegistration | null>;
  loadTemplate(templateKey: string): Promise<WhatsAppTemplateRegistryEntry | null>;
  recordProviderAcceptance(input: RecordWhatsAppProviderAcceptanceInput): Promise<{
    status: WhatsAppAcceptanceRecordStatus;
    result: ProviderSendResult;
  }>;
}

export interface DispatchWhatsAppOutboxJobInput {
  ctx: ActorContext;
  queuedJob: OutboxJob;
  meta: CommandMeta;
  config: ConfiguredWhatsAppCloudAdapterConfig;
  http: WhatsAppCloudHttpTransport;
  store: WhatsAppOutboundDispatchStore;
}

export interface WhatsAppOutboundDispatchResult extends ProviderSendResult {
  deliverySemantics: "PROVIDER_ACCEPTANCE_ONLY";
  acceptanceRecordStatus: WhatsAppAcceptanceRecordStatus;
  providerAccountRef: string;
}

function missingRequiredTemplate(): Result<never> {
  return { ok: false, code: "WHATSAPP_TEMPLATE_REQUIRED", message: "Approved WhatsApp template is required outside the customer-service window." };
}

function assertConversationVersionIsCurrent(queuedJob: OutboxJob, latestJob: OutboxJob): Result<true> {
  const queuedVersion = queuedJob.handoverGuard?.expectedConversationVersion;
  const latestVersion = latestJob.handoverGuard?.expectedConversationVersion;
  if (queuedVersion !== undefined && latestVersion !== undefined && queuedVersion !== latestVersion) {
    return {
      ok: false,
      code: "STALE_CONVERSATION_VERSION",
      message: "WhatsApp outbox job was queued for an older conversation version and must be re-evaluated before send.",
    };
  }
  return { ok: true, value: true };
}

export async function dispatchWhatsAppOutboxJob(input: DispatchWhatsAppOutboxJobInput): Promise<Result<WhatsAppOutboundDispatchResult>> {
  const latestJob = await input.store.loadLatestOutboxJob(input.queuedJob.id);
  if (!latestJob) {
    return { ok: false, code: "OUTBOX_JOB_NOT_FOUND", message: "WhatsApp outbox job no longer exists at dispatch time." };
  }

  const conversationVersion = assertConversationVersionIsCurrent(input.queuedJob, latestJob);
  if (!conversationVersion.ok) return conversationVersion;

  const prepared = prepareWhatsAppDispatch(input.ctx, latestJob, input.meta);
  if (!prepared.ok) return prepared;

  const providerAccount = await input.store.loadProviderAccount(latestJob.workspaceId);
  if (!providerAccount) {
    return { ok: false, code: "WHATSAPP_PROVIDER_ACCOUNT_NOT_CONFIGURED", message: "WhatsApp provider account is not configured for workspace." };
  }
  if (providerAccount.workspaceId !== latestJob.workspaceId) {
    return { ok: false, code: "WHATSAPP_PROVIDER_ACCOUNT_SCOPE_MISMATCH", message: "WhatsApp provider account workspace does not match outbox job workspace." };
  }

  if (prepared.value.policy.requiresTemplate) {
    if (!latestJob.templateKey) return missingRequiredTemplate();
    const templateReady = evaluateWhatsAppTemplateRegistration(await input.store.loadTemplate(latestJob.templateKey), {
      purpose: latestJob.purpose,
      locale: input.config.templateLanguageCode ?? "en_US",
    });
    if (!templateReady.ok) return templateReady;
  }

  const sent = await sendConfiguredWhatsAppCloudMessage(
    input.ctx,
    latestJob,
    input.meta,
    {
      ...input.config,
      phoneNumberId: providerAccount.phoneNumberId,
    },
    input.http,
  );
  if (!sent.ok) return sent;

  const recorded = await input.store.recordProviderAcceptance({
    job: latestJob,
    result: sent.value,
    idempotencyKey: prepared.value.dispatch.idempotencyKey,
    recordedAt: sent.value.acceptedAt,
  });

  return {
    ok: true,
    value: {
      ...recorded.result,
      deliverySemantics: "PROVIDER_ACCEPTANCE_ONLY",
      acceptanceRecordStatus: recorded.status,
      providerAccountRef: providerAccount.providerAccountRef,
    },
  };
}
