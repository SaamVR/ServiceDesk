import type { ActorContext, CommandMeta, Result } from "../../../contracts";
import { ensureTenant, hasRecipientSuppression, type OutboxJob } from "../types";
import { isInsideCustomerServiceWindow } from "./adapter";

export interface WhatsAppDispatchPolicy {
  channel: "WHATSAPP";
  requiresTemplate: boolean;
  handoverVersion?: number;
  deliverySemantics: "PROVIDER_ACCEPTANCE_ONLY";
}

export interface PreparedWhatsAppDispatch {
  dispatch: {
    jobId: string;
    workspaceId: string;
    idempotencyKey: string;
    providerAccountRef: string;
    templateKey?: string;
    freeformText?: string;
    deliverySemantics: "PROVIDER_ACCEPTANCE_ONLY";
  };
  policy: WhatsAppDispatchPolicy;
}

export function prepareWhatsAppDispatch(ctx: ActorContext, job: OutboxJob, meta: CommandMeta): Result<PreparedWhatsAppDispatch> {
  const tenant = ensureTenant(ctx, job.workspaceId);
  if (!tenant.ok) return tenant;

  if (job.channel !== "WHATSAPP") {
    return { ok: false, code: "WRONG_DELIVERY_CHANNEL", message: "WhatsApp dispatcher received a non-WhatsApp outbox job." };
  }

  const suppression = hasRecipientSuppression(job);
  if (suppression) {
    return { ok: false, code: suppression, message: "WhatsApp dispatch suppressed before provider call." };
  }

  if (!job.idempotencyKey) {
    return { ok: false, code: "MISSING_IDEMPOTENCY_KEY", message: "WhatsApp dispatch requires an outbox idempotency key." };
  }

  const lastInboundAt = typeof job.payload.lastInboundAt === "string" ? job.payload.lastInboundAt : undefined;
  const insideCustomerWindow = isInsideCustomerServiceWindow(lastInboundAt, meta.now);
  const requiresTemplate = !insideCustomerWindow;

  if (requiresTemplate && !job.templateKey) {
    return { ok: false, code: "WHATSAPP_TEMPLATE_REQUIRED", message: "WhatsApp freeform messages are blocked outside the customer-service window." };
  }

  return {
    ok: true,
    value: {
      dispatch: {
        jobId: job.id,
        workspaceId: job.workspaceId,
        idempotencyKey: job.idempotencyKey,
        providerAccountRef: "WHATSAPP_BUSINESS_ACCOUNT",
        templateKey: job.templateKey,
        freeformText: requiresTemplate ? undefined : job.freeformText,
        deliverySemantics: "PROVIDER_ACCEPTANCE_ONLY",
      },
      policy: {
        channel: "WHATSAPP",
        requiresTemplate,
        handoverVersion: job.handoverGuard?.expectedConversationVersion,
        deliverySemantics: "PROVIDER_ACCEPTANCE_ONLY",
      },
    },
  };
}
