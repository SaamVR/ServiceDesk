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
  /** Optional durable acceptance preflight: prevent duplicate sends on retries. */
  loadRecordedProviderAcceptance?(workspaceId: string,
    idempotencyKey: string): Promise<ProviderSendResult | null>;
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
  if ((queuedJob.handoverGuard?.conversationId &&
        latestJob.handoverGuard?.conversationId !==
          queuedJob.handoverGuard.conversationId) ||
      (queuedVersion !== undefined && latestVersion !== queuedVersion)) {
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

  // A queued dispatch cannot silently send a replacement recipient, template
  // or idempotency identity loaded under the same outbox primary key.
  if (latestJob.id !== input.queuedJob.id ||
      latestJob.workspaceId !== input.queuedJob.workspaceId ||
      latestJob.channel !== input.queuedJob.channel ||
      latestJob.purpose !== input.queuedJob.purpose ||
      latestJob.idempotencyKey !== input.queuedJob.idempotencyKey ||
      latestJob.recipient.recipientRef !==
        input.queuedJob.recipient.recipientRef ||
      latestJob.freeformText !== input.queuedJob.freeformText ||
      latestJob.templateKey !== input.queuedJob.templateKey) {
    return {ok:false,code:"STALE_OUTBOX_JOB",
      message:"WhatsApp queued job identity or customer-facing content changed before dispatch."};
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

  // A durable acceptance lookup lets the integrator short-circuit
  // replays BEFORE hitting the provider. A post-send duplicate receipt alone
  // cannot prevent customers receiving a second message.
  if (input.store.loadRecordedProviderAcceptance) {
    const recorded = await input.store.loadRecordedProviderAcceptance(
      latestJob.workspaceId, prepared.value.dispatch.idempotencyKey);
    if (recorded) {
      if (recorded.jobId !== latestJob.id) {
        return {ok:false,code:"WHATSAPP_ACCEPTANCE_SCOPE_MISMATCH",
          message:"Previously recorded acceptance refers to another outbox job."};
      }
      return {ok:true,value:{...recorded,
        deliverySemantics:"PROVIDER_ACCEPTANCE_ONLY",
        acceptanceRecordStatus:"DUPLICATE",
        providerAccountRef:providerAccount.providerAccountRef}};
    }
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
