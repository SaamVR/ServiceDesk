import type { TransactionalEmailJob, TransactionalEmailPolicy, TransactionalEmailPurpose } from "./adapter";

export interface TransactionalEmailTemplateDefinition {
  purpose: TransactionalEmailPurpose;
  subject: string;
  heading: string;
  body: string;
  ctaLabel: string;
}

export const TRANSACTIONAL_EMAIL_TEMPLATES: Record<TransactionalEmailPurpose, TransactionalEmailTemplateDefinition> = {
  QUOTE_READY: {
    purpose: "QUOTE_READY",
    subject: "Your quote is ready",
    heading: "Your quote is ready",
    body: "Review the quote and next steps in your ServiceDesk workspace.",
    ctaLabel: "Review quote",
  },
  BOOKING_CONFIRMED: {
    purpose: "BOOKING_CONFIRMED",
    subject: "Booking confirmed",
    heading: "Booking confirmed",
    body: "Your booking has been confirmed. Review timing and preparation details in your ServiceDesk workspace.",
    ctaLabel: "View booking",
  },
  INVOICE_ISSUED: {
    purpose: "INVOICE_ISSUED",
    subject: "Invoice issued",
    heading: "Invoice issued",
    body: "An invoice is available in your ServiceDesk workspace.",
    ctaLabel: "View invoice",
  },
  PAYMENT_RECEIPT: {
    purpose: "PAYMENT_RECEIPT",
    subject: "Payment receipt",
    heading: "Payment received",
    body: "Your payment has been received and recorded in ServiceDesk.",
    ctaLabel: "View receipt",
  },
  PAYMENT_REMINDER: {
    purpose: "PAYMENT_REMINDER",
    subject: "Payment reminder",
    heading: "Payment reminder",
    body: "A payment is still pending. Open your ServiceDesk workspace to review the balance.",
    ctaLabel: "Review payment",
  },
  VISIT_REMINDER: {
    purpose: "VISIT_REMINDER",
    subject: "Upcoming visit reminder",
    heading: "Upcoming visit reminder",
    body: "A scheduled visit is coming up. Review timing and preparation details in your ServiceDesk workspace.",
    ctaLabel: "View visit",
  },
};

export interface BuildTransactionalEmailJobInput {
  workspaceId: string;
  purpose: TransactionalEmailPurpose;
  to: string;
  resourceId: string;
  publicUrl?: string;
  policy: TransactionalEmailPolicy;
}

function actionLine(definition: TransactionalEmailTemplateDefinition, publicUrl?: string): string {
  if (!publicUrl) return "Open your ServiceDesk workspace to continue.";
  return `${definition.ctaLabel}: ${publicUrl}`;
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildTransactionalEmailJob(input: BuildTransactionalEmailJobInput): TransactionalEmailJob {
  const definition = TRANSACTIONAL_EMAIL_TEMPLATES[input.purpose];
  const action = actionLine(definition, input.publicUrl);
  const text = `${definition.heading}\n\n${definition.body}\n\n${action}`;
  const html = `<h1>${htmlEscape(definition.heading)}</h1><p>${htmlEscape(definition.body)}</p><p>${htmlEscape(action)}</p>`;

  return {
    idempotencyKey: `email:${input.workspaceId}:${input.purpose}:${input.resourceId}`,
    workspaceId: input.workspaceId,
    purpose: input.purpose,
    to: input.to,
    subject: definition.subject,
    html,
    text,
    policy: input.policy,
  };
}
