import type { ActorContext, InvoiceDTO, QualityCaseDTO, VisitDTO } from "@/contracts";
import type { WorkspaceSnapshot } from "@/server/core/facade";
import type { ProductActionError, ProductCommandResult } from "@/features/operations/server-action-adapters";

export interface InvoiceQualityRecoverySnapshot {
  invoices: InvoiceDTO[];
  qualityCases: QualityCaseDTO[];
  visits: VisitDTO[];
  invoice?: InvoiceDTO;
  qualityCase?: QualityCaseDTO;
  visit?: VisitDTO;
}

function failure<T>(code: string, message: string): ProductCommandResult<T> {
  const error: ProductActionError = { code, message };
  return { ok: false, error };
}

export function validateExpandedWorkspaceSnapshot(ctx: ActorContext, snapshot: WorkspaceSnapshot): ProductCommandResult<WorkspaceSnapshot> {
  const collections: Array<[string, Array<{ id: string; workspaceId: string }>]> = [
    ["request", snapshot.requests],
    ["quote", snapshot.quotes],
    ["visit", snapshot.visits],
    ["invoice", snapshot.invoices],
    ["conversation", snapshot.conversations],
    ["message", snapshot.messages],
    ["recurrenceRule", snapshot.recurrenceRules],
    ["visitEvidence", snapshot.visitEvidence],
    ["visitChecklistItem", snapshot.visitChecklistItems],
    ["attentionItem", snapshot.attentionItems],
    ["qualityCase", snapshot.qualityCases],
  ];
  for (const [resourceType, items] of collections) {
    const offender = items.find((item) => item.workspaceId !== ctx.workspaceId);
    if (offender) return failure("WORKSPACE_MISMATCH", `${resourceType} ${offender.id} belongs to a different workspace.`);
  }
  return { ok: true, value: snapshot };
}

export function buildInvoiceQualityRecoverySnapshot(ctx: ActorContext, snapshot: WorkspaceSnapshot, selection: { invoiceId?: string; qualityCaseId?: string; visitId?: string } = {}): ProductCommandResult<InvoiceQualityRecoverySnapshot> {
  const valid = validateExpandedWorkspaceSnapshot(ctx, snapshot);
  if (!valid.ok) return valid as ProductCommandResult<InvoiceQualityRecoverySnapshot>;
  const invoice = selection.invoiceId ? snapshot.invoices.find((candidate) => candidate.id === selection.invoiceId) : snapshot.invoices[0];
  const qualityCase = selection.qualityCaseId ? snapshot.qualityCases.find((candidate) => candidate.id === selection.qualityCaseId) : snapshot.qualityCases[0];
  const visit = selection.visitId ? snapshot.visits.find((candidate) => candidate.id === selection.visitId) : invoice?.visitId ? snapshot.visits.find((candidate) => candidate.id === invoice.visitId) : qualityCase?.visitId ? snapshot.visits.find((candidate) => candidate.id === qualityCase.visitId) : snapshot.visits[0];
  if (selection.invoiceId && !invoice) return failure("INVOICE_NOT_FOUND", "Selected invoice is absent from the workspace snapshot.");
  if (selection.qualityCaseId && !qualityCase) return failure("QUALITY_CASE_NOT_FOUND", "Selected quality case is absent from the workspace snapshot.");
  return { ok: true, value: { invoices: snapshot.invoices, qualityCases: snapshot.qualityCases, visits: snapshot.visits, invoice, qualityCase, visit } };
}
