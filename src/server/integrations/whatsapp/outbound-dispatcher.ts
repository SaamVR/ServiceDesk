import type { ActorContext, CommandMeta, Result } from "../../../contracts";
import type { OutboxJob, ProviderSendResult } from "../types";
import {
  sendConfiguredWhatsAppCloudMessage,
  type ConfiguredWhatsAppCloudAdapterConfig,
} from "./configured-adapter";
import type { WhatsAppCloudHttpTransport } from "./cloud-api";
import { prepareWhatsAppDispatch } from "./outbound-policy";

export type WhatsAppTemplateApprovalStatus = "APPROVED" | "CONFIGURED" | "MISSING" | "DISABLED";

export interface WhatsAppTemplateRegistration {
  templateKey: string;
  locale: string;
  status: WhatsAppTemplateApprovalStatus;
}

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
  loadTemplate(templateKey: string): Promise<WhatsAppTemplateRegistration | null>;
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

function templateStatusFailure(templateKey: string, registration: WhatsAppTemplateRegistration | null): Result<true> {
  if (!registration || registration.status === "MISSING") {
    return { ok: false, code: "WHATSAPP_TEMPLATE_MISSING", message: `WhatsApp template ${templateKey} is not registered.` };
  }
  if (registration.status !== "APPROVED") {
    return { ok: false, code: "WHATSAPP_TEMPLATE_NOT_APPROVED", message: `WhatsApp template ${templateKey} is not approved for provider dispatch.` };
  }
  return { ok: true, value: true };
}

export async function dispatchWhatsAppOutboxJob(input: DispatchWhatsAppOutboxJobInput): Promise<Result<WhatsAppOutboundDispatchResult>> {
  const latestJob = await input.store.loadLatestOutboxJob(input.queuedJob.id);
  if (!latestJob) {
    return { ok: false, code: "OUTBOX_JOB_NOT_FOUND", message: "WhatsApp outbox job no longer exists at dispatch time." };
  }

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
    const template = latestJob.templateKey ? await input.store.loadTemplate(latestJob.templateKey) : null;
    const templateReady = latestJob.templateKey
      ? templateStatusFailure(latestJob.templateKey, template)
      : ({ ok: false, code: "WHATSAPP_TEMPLATE_REQUIRED", message: "Approved WhatsApp template is required outside the customer-service window." } as const);
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
