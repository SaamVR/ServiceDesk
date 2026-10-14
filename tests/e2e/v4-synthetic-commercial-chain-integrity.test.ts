import { describe, expect, it } from "vitest";
import { createQuoteSnapshot, defaultRateCard } from "../../src/domain/quote";
import { parsePersistedQuoteRateCard } from "../../src/server/core/operational-quote-rate-card";
import { assessOperationalQuoteSend } from "../../src/features/operations/quote-send-readiness";
import { verifyCustomerQuoteForAcceptance } from "../../src/features/operations/customer-quote-acceptance";
import { verifiedSandboxPaymentLedgerMatch } from "../../src/features/operations/sandbox-payment-ledger-proof";
import { customerBookingPaymentSummary } from "../../src/features/operations/customer-booking-payment-truth";
import { isVerifiedPaidInvoiceMilestone } from "../../src/server/workflows/paid-invoice-milestone";
import { summarizeWorkflowEvidence } from "../../src/features/operations/workflow-evidence-summary";

const id = {
  workspace: "11111111-1111-4111-8111-111111111111",
  request: "22222222-2222-4222-8222-222222222222",
  quote: "33333333-3333-4333-8333-333333333333",
  invoice: "44444444-4444-4444-8444-444444444444",
  checkout: "55555555-5555-4555-8555-555555555555",
};
const now = "2026-10-15T00:00:00.000Z";
const persistedRate = {
  active: true, version: "synthetic-fixture-owner-approved-v4", currency: "USD",
  deposit_percent: 25, valid_hours: 48, buffer_minutes: 30,
  rules: {
    autoApprovalMaxTotalMinor: 50000,
    moveOut: defaultRateCard.moveOut,
    standard: defaultRateCard.standard,
    deep: defaultRateCard.deep,
  },
};
function quoteJourney() {
  const price = parsePersistedQuoteRateCard(persistedRate);
  expect(price.ok).toBe(true);
  if (!price.ok) throw Error("fixture-priced-branch-invalid");
  const calculated = createQuoteSnapshot({
    id: id.quote, workspaceId: id.workspace, requestId: id.request,
    serviceCode: "STANDARD", bedrooms: 1, bathrooms: 1, now,
  }, price.value);
  const persisted = {
    currency: calculated.currency,
    valid_until: calculated.validUntil,
    subtotal_minor: calculated.subtotalMinor, tax_minor: calculated.taxMinor,
    total_minor: calculated.totalMinor, deposit_minor: calculated.depositMinor,
    balance_minor: calculated.balanceMinor, duration_minutes: calculated.durationMinutes,
    snapshot: { lineItems: calculated.lineItems },
  };
  return { calculated, persisted };
}

describe("CT0 cross-module synthetic commercial acceptance contract — NO real owner or provider proof", () => {
  it("preserves saved owner-priced quote -> reviewed send -> customer acceptance -> sandbox ledger -> invoice -> internal attention truth", () => {
    const { calculated, persisted } = quoteJourney();
    expect(calculated.status).toBe("APPROVED");
    expect(assessOperationalQuoteSend({ ...persisted, status: "APPROVED" }, now))
      .toEqual({ ok: true });
    expect(verifyCustomerQuoteForAcceptance({ ...persisted, status: "SENT" }, now))
      .toEqual({ ok: true });

    const compact = id.checkout.replaceAll("-", "");
    const event = "evt_sd_demo_" + compact, transaction = "pi_sd_demo_" + compact;
    const session = {
      id: id.checkout, workspace_id: id.workspace, quote_id: id.quote, invoice_id: id.invoice,
      purpose: "BALANCE", status: "APPLIED", currency: calculated.currency,
      amount_minor: calculated.totalMinor, provider_event_id: event, provider_transaction_id: transaction,
    };
    const applied = {
      workspace_id: id.workspace, quote_id: id.quote, invoice_id: id.invoice,
      purpose: "BALANCE", state: "APPLIED", currency: calculated.currency,
      amount_minor: calculated.totalMinor, provider_event_id: event, provider_transaction_id: transaction,
      provider: "STRIPE", provider_account_id: "acct_servicedesk_internal_sandbox",
    };
    expect(verifiedSandboxPaymentLedgerMatch(session, applied)).toBe(true);

    const invoice = {
      status: "PAID", currency: calculated.currency,
      total_minor: calculated.totalMinor, allocated_minor: calculated.totalMinor,
      refunded_minor: 0, balance_minor: 0,
    };
    expect(isVerifiedPaidInvoiceMilestone(invoice)).toBe(true);
    expect(customerBookingPaymentSummary({
      status: invoice.status, currency: invoice.currency,
      totalMinor: invoice.total_minor, allocatedMinor: invoice.allocated_minor,
      refundedMinor: invoice.refunded_minor, balanceMinor: invoice.balance_minor,
    })).toMatchObject({ title: "Invoice recorded as paid", tone: "success" });

    const live = {
      id: "execution-1", branchId: "branch-1", ruleId: "rule-1", ruleVersionId: "version-1",
      mode: "LIVE" as const, eventType: "QUOTE_ACCEPTED", matched: true, recursionDepth: 0,
      state: "ACTIONS_PENDING" as const, createdAt: now,
    };
    const internal = {
      id: "action-1", branchId: live.branchId, executionId: live.id, actionIndex: 0,
      attemptNumber: 1, actionType: "CREATE_ATTENTION" as const, state: "SUCCEEDED" as const,
      createdAt: now,
    };
    expect(summarizeWorkflowEvidence({
      workflowExecutions: [live], workflowActionExecutions: [internal],
    })).toMatchObject({
      recordedLiveExecutions: 1, matchedLiveExecutions: 1,
      internalAttentionSucceeded: 1, providerDeliveryVerified: false,
    });
  });

  it("rejects unknown prices, tampered customer quote, absent payment identity and unbalanced invoice", () => {
    expect(parsePersistedQuoteRateCard({
      ...persistedRate, version: "synthetic-cleaning-v1",
    })).toMatchObject({ ok: false });
    const { persisted, calculated } = quoteJourney();
    const corrupted = {
      ...persisted, total_minor: calculated.totalMinor + 1,
    };
    expect(assessOperationalQuoteSend({ ...corrupted, status: "APPROVED" }, now))
      .toMatchObject({ ok: false, reason: "CHARGES_UNVERIFIED" });
    expect(verifyCustomerQuoteForAcceptance({ ...corrupted, status: "SENT" }, now))
      .toMatchObject({ ok: false, code: "QUOTE_TOTAL_UNVERIFIED" });
    expect(verifiedSandboxPaymentLedgerMatch({
      status: "APPLIED", purpose: "BALANCE", id: id.checkout, workspace_id: id.workspace,
      quote_id: id.quote, invoice_id: undefined, amount_minor: calculated.totalMinor,
    }, { invoice_id: undefined })).toBe(false);
    expect(isVerifiedPaidInvoiceMilestone({
      status: "PAID", currency: "USD", total_minor: calculated.totalMinor,
      allocated_minor: 0, refunded_minor: 0, balance_minor: 0,
    })).toBe(false);
    expect(customerBookingPaymentSummary({
      status: "PAID", currency: "USD", totalMinor: calculated.totalMinor,
      allocatedMinor: 0, refundedMinor: 0, balanceMinor: 0,
    })).toMatchObject({ title: "Payment figures need review", tone: "warning" });
    const preview = {
      id: "preview", branchId: "branch-1", ruleId: "rule-1", ruleVersionId: "version-1",
      mode: "PREVIEW" as const, eventType: "QUOTE_ACCEPTED", matched: true, recursionDepth: 0,
      state: "PREVIEWED" as const, createdAt: now,
    };
    const previewAction = {
      id: "preview-attention", branchId: "branch-1", executionId: preview.id,
      actionIndex: 0, attemptNumber: 1, actionType: "CREATE_ATTENTION" as const,
      state: "SUCCEEDED" as const, createdAt: now,
    };
    expect(summarizeWorkflowEvidence({
      workflowExecutions: [preview], workflowActionExecutions: [previewAction],
    })).toMatchObject({
      recordedLiveExecutions: 0, internalAttentionSucceeded: 0,
      previewExecutions: 1, providerDeliveryVerified: false,
    });
  });
});
