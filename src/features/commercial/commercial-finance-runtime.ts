import type {
  AccountingReconciliationSnapshotDTO,
  CommercialBillingDraftDTO,
  CommercialBillingLineDTO,
  CommercialPortfolioSnapshotDTO,
} from "@/contracts";
import { createPostgresAccountingReconciliationReader } from "@/server/core/accounting-reconciliation-postgres";
import { createPostgresCommercialBillingCommands } from "@/server/core/commercial-billing-postgres";
import { createPostgresCommercialPortfolioReader } from "@/server/core/commercial-read-postgres";
import { resolveStaffActor } from "@/features/operations/operational-product-runtime";

type Row = Record<string, unknown>;

export interface CommercialFinanceInvoice {
  id: string;
  commercialBillingDraftId: string;
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";
  currency: string;
  totalMinor: number;
  allocatedMinor: number;
  refundedMinor: number;
  balanceMinor: number;
}

export interface CommercialFinanceSnapshot {
  workspaceName: string;
  timeZone: string;
  portfolio: CommercialPortfolioSnapshotDTO;
  drafts: CommercialBillingDraftDTO[];
  invoices: CommercialFinanceInvoice[];
  billingReady: boolean;
  accounting?: AccountingReconciliationSnapshotDTO;
  accountingReady: boolean;
}

export type CommercialFinanceLoadResult =
  | { ok: true; value: CommercialFinanceSnapshot }
  | { ok: false; message: string };

export type CommercialFinanceActionResult =
  | { ok: true; message: string; invoiceId?: string }
  | { ok: false; message: string };

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function text(row: Row, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function number(row: Row, key: string): number {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function record(row: Row, key: string): Record<string, unknown> {
  const value = row[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function mapLine(row: Row): CommercialBillingLineDTO {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    draftId: String(row.draft_id),
    sourceType: String(row.source_type) as CommercialBillingLineDTO["sourceType"],
    visitId: text(row, "visit_id"),
    exceptionCaseId: text(row, "exception_case_id"),
    direction: String(row.direction) as CommercialBillingLineDTO["direction"],
    amountMinor: number(row, "amount_minor"),
    currency: String(row.currency) as CommercialBillingLineDTO["currency"],
    state: String(row.state) as CommercialBillingLineDTO["state"],
    descriptionSnapshot: record(row, "description_snapshot"),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapDraft(row: Row, billingLines: CommercialBillingLineDTO[]): CommercialBillingDraftDTO {
  const id = String(row.id);
  return {
    id,
    workspaceId: String(row.workspace_id),
    organizationId: String(row.organization_id),
    contractId: String(row.contract_id),
    contractVersionId: String(row.contract_version_id),
    periodStart: String(row.period_start),
    periodEnd: String(row.period_end),
    state: String(row.state) as CommercialBillingDraftDTO["state"],
    currency: String(row.currency) as CommercialBillingDraftDTO["currency"],
    chargeMinor: number(row, "charge_minor"),
    creditMinor: number(row, "credit_minor"),
    netTotalMinor: number(row, "net_total_minor"),
    invoiceId: text(row, "invoice_id"),
    version: number(row, "version"),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lines: billingLines.filter((line) => line.draftId === id),
  };
}

function mapInvoice(row: Row): CommercialFinanceInvoice | undefined {
  const draftId = text(row, "commercial_billing_draft_id");
  if (!draftId) return undefined;
  return {
    id: String(row.id),
    commercialBillingDraftId: draftId,
    status: String(row.status) as CommercialFinanceInvoice["status"],
    currency: String(row.currency),
    totalMinor: number(row, "total_minor"),
    allocatedMinor: number(row, "allocated_minor"),
    refundedMinor: number(row, "refunded_minor"),
    balanceMinor: number(row, "balance_minor"),
  };
}

function rejected(code: string, fallback: string): CommercialFinanceActionResult {
  if (code === "FORBIDDEN") return { ok: false, message: "You do not have permission to manage commercial billing." };
  if (code === "COMMERCIAL_FEATURE_DISABLED") return { ok: false, message: "Commercial operations are not enabled for this workspace." };
  if (code === "COMMERCIAL_BILLING_RATE_UNRESOLVED") {
    return { ok: false, message: "A completed visit does not have a supported fixed-per-visit contract rate. Review the contract pricing first." };
  }
  if (code === "COMMERCIAL_BILLING_NO_ELIGIBLE_VISITS") {
    return { ok: false, message: "No completed, review-cleared contract visits are available in that billing period." };
  }
  if (code === "COMMERCIAL_BILLING_VISIT_ALREADY_INCLUDED") {
    return { ok: false, message: "A visit in this period is already included in another active or finalized commercial bill." };
  }
  if (code === "COMMERCIAL_BILLING_PERIOD_OUTSIDE_CONTRACT") {
    return { ok: false, message: "The billing period must stay inside the approved contract version dates." };
  }
  if (code === "COMMERCIAL_BILLING_VERSION_CONFLICT") {
    return { ok: false, message: "This billing draft changed since the page loaded. Refresh before making another change." };
  }
  if (code === "COMMERCIAL_BILLING_CONTRACT_NO_LONGER_ISSUABLE") {
    return { ok: false, message: "The contract is no longer eligible for invoice issue. Review the contract status first." };
  }
  if (code === "COMMERCIAL_BILLING_NONPOSITIVE_TOTAL" || code === "COMMERCIAL_BILLING_EMPTY_DRAFT") {
    return { ok: false, message: "Include at least one positive billable line before issuing the invoice." };
  }
  if (code.includes("LOCKED")) return { ok: false, message: "This commercial bill is already locked and can no longer be edited." };
  return { ok: false, message: fallback };
}

export async function loadCommercialFinanceSnapshot(workspaceSlug: string): Promise<CommercialFinanceLoadResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };

  const portfolioResult = await createPostgresCommercialPortfolioReader(resolved.value.rpc)
    .readCommercialPortfolioSnapshot(resolved.value.actor);
  if (!portfolioResult.ok) {
    return { ok: false, message: "Commercial operations are not enabled for this workspace." };
  }

  const [draftRead, lineRead, invoiceRead, accountingResult] = await Promise.all([
    resolved.value.service
      .from("commercial_billing_drafts")
      .select("*")
      .eq("workspace_id", resolved.value.workspace.id)
      .order("updated_at", { ascending: false })
      .limit(50),
    resolved.value.service
      .from("commercial_billing_lines")
      .select("*")
      .eq("workspace_id", resolved.value.workspace.id)
      .order("created_at", { ascending: true })
      .limit(1000),
    resolved.value.service
      .from("invoices")
      .select("id,commercial_billing_draft_id,status,currency,total_minor,allocated_minor,refunded_minor,balance_minor")
      .eq("workspace_id", resolved.value.workspace.id)
      .not("commercial_billing_draft_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(100),
    createPostgresAccountingReconciliationReader(resolved.value.rpc)
      .readAccountingReconciliationSnapshot(resolved.value.actor),
  ]);

  const billingReady = !draftRead.error && !lineRead.error && !invoiceRead.error;
  const lines = billingReady ? rows(lineRead.data).map(mapLine) : [];
  const drafts = billingReady ? rows(draftRead.data).map((row) => mapDraft(row, lines)) : [];
  const invoices = billingReady
    ? rows(invoiceRead.data).map(mapInvoice).filter((invoice): invoice is CommercialFinanceInvoice => Boolean(invoice))
    : [];

  return {
    ok: true,
    value: {
      workspaceName: resolved.value.workspace.name,
      timeZone: resolved.value.workspace.timezone,
      portfolio: portfolioResult.value,
      drafts,
      invoices,
      billingReady,
      accounting: accountingResult.ok ? accountingResult.value : undefined,
      accountingReady: accountingResult.ok,
    },
  };
}

export async function createCommercialBillingDraft(
  workspaceSlug: string,
  contractVersionId: string,
  periodStart: string,
  periodEnd: string,
): Promise<CommercialFinanceActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };

  const result = await createPostgresCommercialBillingCommands(resolved.value.rpc).createCommercialBillingDraft(
    resolved.value.actor,
    { contractVersionId, periodStart, periodEnd, now: new Date().toISOString() },
  );
  if (!result.ok) return rejected(result.code, "The commercial invoice draft could not be created.");

  return {
    ok: true,
    message: result.value.duplicate
      ? "The existing commercial billing draft is already available below."
      : "Commercial billing draft created from completed, review-cleared visits.",
  };
}

export async function setCommercialBillingLineState(
  workspaceSlug: string,
  draftId: string,
  lineId: string,
  state: "INCLUDED" | "EXCLUDED",
  expectedVersion: number,
): Promise<CommercialFinanceActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };

  const result = await createPostgresCommercialBillingCommands(resolved.value.rpc).setCommercialBillingLineState(
    resolved.value.actor,
    { draftId, lineId, state, expectedVersion, now: new Date().toISOString() },
  );
  if (!result.ok) return rejected(result.code, "The billing line could not be updated.");

  return {
    ok: true,
    message: state === "INCLUDED" ? "Billing line included." : "Billing line excluded from this draft.",
  };
}

export async function finalizeCommercialBillingDraft(
  workspaceSlug: string,
  draftId: string,
  expectedVersion: number,
): Promise<CommercialFinanceActionResult> {
  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) return { ok: false, message: resolved.message };

  const result = await createPostgresCommercialBillingCommands(resolved.value.rpc).finalizeCommercialBillingDraft(
    resolved.value.actor,
    { draftId, expectedVersion, now: new Date().toISOString() },
  );
  if (!result.ok) return rejected(result.code, "The commercial invoice could not be issued.");

  return {
    ok: true,
    invoiceId: result.value.invoice.id,
    message: result.value.duplicate
      ? "This commercial invoice was already issued."
      : "Commercial invoice issued. Payment remains outstanding until an authoritative payment is recorded.",
  };
}
