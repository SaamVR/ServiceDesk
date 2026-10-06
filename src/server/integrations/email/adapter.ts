import type { Result } from "../../../contracts";
import type { ProviderMode, RedactedProviderEvidence } from "../types";

export type TransactionalEmailPurpose =
  | "QUOTE_READY"
  | "BOOKING_CONFIRMED"
  | "INVOICE_ISSUED"
  | "PAYMENT_RECEIPT"
  | "PAYMENT_REMINDER"
  | "VISIT_REMINDER"
  | "CUSTOMER_REPLY"
  | "RETENTION_CAMPAIGN";

export type EmailSuppressionCode =
  | "RECIPIENT_OPTED_OUT"
  | "RECIPIENT_HARD_BOUNCED"
  | "HANDOVER_OPEN"
  | "CUSTOMER_REPLIED_NEEDS_REVIEW"
  | "BOOKING_ALREADY_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "INVOICE_ALREADY_PAID"
  | "INVOICE_VOID";

export interface TransactionalEmailPolicy {
  optedOut?: boolean;
  hardBounced?: boolean;
  handoverOpen?: boolean;
  hasRecentReply?: boolean;
  bookingStatus?: "REQUESTED" | "QUOTE_SENT" | "BOOKED" | "CANCELLED" | "COMPLETED";
  invoiceStatus?: "DRAFT" | "SENT" | "PAID" | "VOID";
}

export interface TransactionalEmailJob {
  idempotencyKey: string;
  workspaceId: string;
  purpose: TransactionalEmailPurpose;
  to: string;
  subject: string;
  html: string;
  text: string;
  policy: TransactionalEmailPolicy;
}

export interface TransactionalEmailSendResult {
  idempotencyKey: string;
  providerMessageId: string;
  acceptedAt: string;
  mode: ProviderMode;
  evidence: RedactedProviderEvidence;
}

export interface TransactionalEmailAdapter {
  send(job: TransactionalEmailJob): Promise<Result<TransactionalEmailSendResult>>;
}

function recipientDomain(email: string): string {
  return email.includes("@") ? email.split("@").at(-1) ?? "unknown-domain" : "unknown-domain";
}

export function shouldSuppressTransactionalEmail(job: Pick<TransactionalEmailJob, "purpose" | "to" | "policy">): EmailSuppressionCode | undefined {
  if (job.policy.optedOut) return "RECIPIENT_OPTED_OUT";
  if (job.policy.hardBounced) return "RECIPIENT_HARD_BOUNCED";
  if (job.policy.handoverOpen && job.purpose !== "CUSTOMER_REPLY") return "HANDOVER_OPEN";
  if (job.policy.bookingStatus === "CANCELLED") return "BOOKING_CANCELLED";

  if (job.purpose === "QUOTE_READY") {
    if (job.policy.bookingStatus === "BOOKED" || job.policy.bookingStatus === "COMPLETED") return "BOOKING_ALREADY_CONFIRMED";
    if (job.policy.hasRecentReply) return "CUSTOMER_REPLIED_NEEDS_REVIEW";
  }

  if (job.purpose === "PAYMENT_REMINDER") {
    if (job.policy.invoiceStatus === "PAID") return "INVOICE_ALREADY_PAID";
    if (job.policy.invoiceStatus === "VOID") return "INVOICE_VOID";
  }

  return undefined;
}

export class FixtureEmailAdapter implements TransactionalEmailAdapter {
  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  async send(job: TransactionalEmailJob): Promise<Result<TransactionalEmailSendResult>> {
    const suppression = shouldSuppressTransactionalEmail(job);
    if (suppression) {
      return {
        ok: false,
        code: suppression,
        message: "Transactional email suppressed by recipient or business-state policy before provider call.",
      };
    }

    const providerMessageId = `email_fixture_${job.idempotencyKey}`;
    return {
      ok: true,
      value: {
        idempotencyKey: job.idempotencyKey,
        providerMessageId,
        acceptedAt: this.now(),
        mode: "FIXTURE",
        evidence: {
          provider: "EMAIL",
          mode: "FIXTURE",
          verification: "CONTRACT_TESTED",
          capturedAt: this.now(),
          controlledId: providerMessageId,
          notes: [
            `Fixture ${job.purpose} email accepted for recipient domain ${recipientDomain(job.to)} only.`,
            "No live email provider receipt exists yet.",
          ],
        },
      },
    };
  }
}
