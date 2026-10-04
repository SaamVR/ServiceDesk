import type { Result } from "../../../contracts";
import type { TransactionalEmailAdapter, TransactionalEmailJob, TransactionalEmailPolicy, TransactionalEmailPurpose } from "../email/adapter";
import type { OutboxJob } from "../types";
import { dispatchOutcomeBase, type CommittedOutboxDispatcher, type CommittedOutboxDispatchInput, type CommittedOutboxDispatchOutcome } from "./dispatch-port";
import { classifyProviderFailure } from "./failure-policy";

const purposeMap: Record<OutboxJob["purpose"], TransactionalEmailPurpose> = {
  QUOTE: "QUOTE_READY",
  CONFIRMATION: "BOOKING_CONFIRMED",
  INVOICE: "INVOICE_ISSUED",
  REMINDER: "VISIT_REMINDER",
  FEEDBACK: "PAYMENT_RECEIPT",
  STAFF_ALERT: "QUOTE_READY",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function payloadFor(job: OutboxJob): Record<string, unknown> {
  const nested = isRecord(job.payload.email) ? job.payload.email : undefined;
  return nested ?? job.payload;
}

function policyFor(value: unknown): TransactionalEmailPolicy {
  return isRecord(value) ? value as TransactionalEmailPolicy : {};
}

export function buildTransactionalEmailJob(job: OutboxJob): Result<TransactionalEmailJob> {
  const payload = payloadFor(job);
  const to = stringField(payload, "to");
  const subject = stringField(payload, "subject");
  const text = stringField(payload, "text");
  const html = stringField(payload, "html");
  if (!to || !subject || !text || !html) {
    return { ok: false, code: "EMAIL_PAYLOAD_INVALID", message: "Resolved EMAIL outbox payload must include to, subject, text and html fields." };
  }

  return {
    ok: true,
    value: {
      idempotencyKey: job.idempotencyKey,
      workspaceId: job.workspaceId,
      purpose: purposeMap[job.purpose],
      to,
      subject,
      text,
      html,
      policy: policyFor(payload.policy),
    },
  };
}

export class EmailCommittedOutboxDispatcher implements CommittedOutboxDispatcher {
  constructor(private readonly adapter: TransactionalEmailAdapter) {}

  async dispatch(input: CommittedOutboxDispatchInput): Promise<Result<CommittedOutboxDispatchOutcome>> {
    if (input.job.channel !== "EMAIL" || input.expectedChannel !== "EMAIL") {
      return { ok: true, value: classifyProviderFailure({ job: input.job, code: "CHANNEL_MISMATCH", message: "Email dispatcher received a non-email outbox job." }) };
    }

    const emailJob = buildTransactionalEmailJob(input.job);
    if (!emailJob.ok) return { ok: true, value: classifyProviderFailure({ job: input.job, code: emailJob.code, message: emailJob.message }) };

    const sent = await this.adapter.send(emailJob.value);
    if (!sent.ok) return { ok: true, value: classifyProviderFailure({ job: input.job, code: sent.code, message: sent.message }) };

    return {
      ok: true,
      value: {
        ...dispatchOutcomeBase(input.job),
        outcome: "ACCEPTED",
        providerMessageId: sent.value.providerMessageId,
        acceptedAt: sent.value.acceptedAt,
        providerMode: sent.value.mode,
        evidence: sent.value.evidence,
      },
    };
  }
}
