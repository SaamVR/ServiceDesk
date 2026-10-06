import type {
  ActorContext,
  CommercialBillingDraftDTO,
  CommercialBillingLineDTO,
  InvoiceDTO,
  Result,
} from "../../contracts";
import { assertCommercialBillingPeriod } from "../../domain/commercial";
import type { SupabaseRpcClient } from "./payment-application-postgres";

interface RpcRow { [key: string]: unknown }

export interface CreateCommercialBillingDraftInput {
  contractVersionId: string;
  periodStart: string;
  periodEnd: string;
  now: string;
}

export interface AddCommercialBillingAdjustmentInput {
  draftId: string;
  exceptionCaseId: string;
  expectedVersion: number;
  now: string;
}

export interface SetCommercialBillingLineStateInput {
  draftId: string;
  lineId: string;
  state: "INCLUDED" | "EXCLUDED";
  expectedVersion: number;
  now: string;
}

export interface FinalizeCommercialBillingDraftInput {
  draftId: string;
  expectedVersion: number;
  now: string;
}

export interface CommercialBillingDraftOutcome {
  draft: CommercialBillingDraftDTO;
  duplicate: boolean;
}

export interface CommercialBillingFinalizeOutcome extends CommercialBillingDraftOutcome {
  invoice: InvoiceDTO;
}

export interface CommercialBillingCommandPort {
  createCommercialBillingDraft(
    ctx: ActorContext,
    input: CreateCommercialBillingDraftInput,
  ): Promise<Result<CommercialBillingDraftOutcome>>;
  addCommercialBillingAdjustment(
    ctx: ActorContext,
    input: AddCommercialBillingAdjustmentInput,
  ): Promise<Result<CommercialBillingDraftOutcome>>;
  setCommercialBillingLineState(
    ctx: ActorContext,
    input: SetCommercialBillingLineStateInput,
  ): Promise<Result<CommercialBillingDraftDTO>>;
  finalizeCommercialBillingDraft(
    ctx: ActorContext,
    input: FinalizeCommercialBillingDraftInput,
  ): Promise<Result<CommercialBillingFinalizeOutcome>>;
}

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function object(value: unknown, key: string): RpcRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Malformed commercial billing payload: ${key}`);
  }
  return value as RpcRow;
}

function list(value: unknown, key: string): RpcRow[] {
  if (!Array.isArray(value)) throw new Error(`Malformed commercial billing payload: ${key}`);
  return value.map((item, index) => object(item, `${key}[${index}]`));
}

function string(row: RpcRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Malformed commercial billing payload: ${key}`);
  }
  return value;
}

function optionalString(row: RpcRow, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function number(row: RpcRow, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Malformed commercial billing payload: ${key}`);
  }
  return value;
}

function record(row: RpcRow, key: string): Record<string, unknown> {
  return object(row[key], key);
}

function boolean(row: RpcRow, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") throw new Error(`Malformed commercial billing payload: ${key}`);
  return value;
}

function mapLine(row: RpcRow): CommercialBillingLineDTO {
  const sourceType = string(row, "sourceType") as CommercialBillingLineDTO["sourceType"];
  const direction = string(row, "direction") as CommercialBillingLineDTO["direction"];
  const state = string(row, "state") as CommercialBillingLineDTO["state"];
  if (!["VISIT", "ADJUSTMENT"].includes(sourceType)) throw new Error("Malformed commercial billing payload: sourceType");
  if (!["CHARGE", "CREDIT"].includes(direction)) throw new Error("Malformed commercial billing payload: direction");
  if (!["INCLUDED", "EXCLUDED"].includes(state)) throw new Error("Malformed commercial billing payload: state");

  return {
    id: string(row, "id"),
    workspaceId: string(row, "workspaceId"),
    draftId: string(row, "draftId"),
    sourceType,
    visitId: optionalString(row, "visitId"),
    exceptionCaseId: optionalString(row, "exceptionCaseId"),
    direction,
    amountMinor: number(row, "amountMinor"),
    currency: string(row, "currency") as CommercialBillingLineDTO["currency"],
    state,
    descriptionSnapshot: record(row, "descriptionSnapshot"),
    createdAt: string(row, "createdAt"),
    updatedAt: string(row, "updatedAt"),
  };
}

function mapDraft(value: unknown, workspaceId: string): CommercialBillingDraftDTO {
  const row = object(value, "draft");
  const state = string(row, "state") as CommercialBillingDraftDTO["state"];
  if (!["DRAFT", "FINALIZED", "VOID"].includes(state)) throw new Error("Malformed commercial billing payload: draft.state");

  const draft: CommercialBillingDraftDTO = {
    id: string(row, "id"),
    workspaceId: string(row, "workspaceId"),
    organizationId: string(row, "organizationId"),
    contractId: string(row, "contractId"),
    contractVersionId: string(row, "contractVersionId"),
    periodStart: string(row, "periodStart"),
    periodEnd: string(row, "periodEnd"),
    state,
    currency: string(row, "currency") as CommercialBillingDraftDTO["currency"],
    chargeMinor: number(row, "chargeMinor"),
    creditMinor: number(row, "creditMinor"),
    netTotalMinor: number(row, "netTotalMinor"),
    invoiceId: optionalString(row, "invoiceId"),
    version: number(row, "version"),
    createdAt: string(row, "createdAt"),
    updatedAt: string(row, "updatedAt"),
    lines: list(row.lines, "lines").map(mapLine),
  };

  if (draft.workspaceId !== workspaceId || draft.lines.some((line) => line.workspaceId !== workspaceId || line.draftId !== draft.id)) {
    throw new Error("Commercial billing payload contained a cross-workspace row.");
  }
  return draft;
}

function mapInvoice(value: unknown, workspaceId: string): InvoiceDTO {
  const row = object(value, "invoice");
  const status = string(row, "status") as InvoiceDTO["status"];
  if (!["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "VOID"].includes(status)) {
    throw new Error("Malformed commercial billing payload: invoice.status");
  }
  const invoice: InvoiceDTO = {
    id: string(row, "id"),
    workspaceId: string(row, "workspaceId"),
    status,
    currency: string(row, "currency") as InvoiceDTO["currency"],
    totalMinor: number(row, "totalMinor"),
    allocatedMinor: number(row, "allocatedMinor"),
    refundedMinor: number(row, "refundedMinor"),
    balanceMinor: number(row, "balanceMinor"),
  };
  if (invoice.workspaceId !== workspaceId) throw new Error("Commercial billing invoice crossed workspace scope.");
  return invoice;
}

function authorized(ctx: ActorContext): boolean {
  return Boolean(ctx.userId) && (ctx.role === "OWNER" || ctx.role === "DISPATCHER");
}

function rpcFailure<T>(data: RpcRow | null, fallback: string): Result<T> {
  return fail(String(data?.code ?? fallback), "Commercial billing command was rejected by the authoritative database boundary.");
}

export function createPostgresCommercialBillingCommands(client: SupabaseRpcClient): CommercialBillingCommandPort {
  return {
    async createCommercialBillingDraft(ctx, input) {
      if (!authorized(ctx)) return fail("FORBIDDEN", "Owner or dispatcher access is required for commercial billing.");
      try {
        assertCommercialBillingPeriod(input);
      } catch (error) {
        return fail("COMMERCIAL_BILLING_INPUT_INVALID", error instanceof Error ? error.message : "Commercial billing period is invalid.");
      }

      const { data, error } = await client.rpc<RpcRow>("servicedesk_create_commercial_billing_draft", {
        p_input: {
          workspaceId: ctx.workspaceId,
          actorUserId: ctx.userId,
          actorRole: ctx.role,
          contractVersionId: input.contractVersionId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          now: input.now,
        },
      });
      if (error) return fail(error.code ?? "COMMERCIAL_BILLING_RPC_ERROR", error.message);
      if (!data || data.ok === false) return rpcFailure(data, "COMMERCIAL_BILLING_CREATE_REJECTED");

      try {
        return {
          ok: true,
          value: {
            draft: mapDraft(data.draft, ctx.workspaceId),
            duplicate: boolean(data, "duplicate"),
          },
        };
      } catch (error) {
        return fail("COMMERCIAL_BILLING_RPC_MALFORMED", error instanceof Error ? error.message : "Malformed commercial billing response.");
      }
    },

    async addCommercialBillingAdjustment(ctx, input) {
      if (!authorized(ctx)) return fail("FORBIDDEN", "Owner or dispatcher access is required for commercial billing.");
      if (
        !input.draftId ||
        !input.exceptionCaseId ||
        !Number.isSafeInteger(input.expectedVersion) ||
        input.expectedVersion <= 0
      ) {
        return fail("COMMERCIAL_ADJUSTMENT_INPUT_INVALID", "Commercial billing adjustment input is invalid.");
      }

      const { data, error } = await client.rpc<RpcRow>("servicedesk_add_commercial_billing_adjustment", {
        p_input: {
          workspaceId: ctx.workspaceId,
          actorUserId: ctx.userId,
          actorRole: ctx.role,
          draftId: input.draftId,
          exceptionCaseId: input.exceptionCaseId,
          expectedVersion: input.expectedVersion,
          now: input.now,
        },
      });
      if (error) return fail(error.code ?? "COMMERCIAL_BILLING_RPC_ERROR", error.message);
      if (!data || data.ok === false) return rpcFailure(data, "COMMERCIAL_ADJUSTMENT_REJECTED");

      try {
        return {
          ok: true,
          value: {
            draft: mapDraft(data.draft, ctx.workspaceId),
            duplicate: boolean(data, "duplicate"),
          },
        };
      } catch (error) {
        return fail("COMMERCIAL_BILLING_RPC_MALFORMED", error instanceof Error ? error.message : "Malformed commercial billing response.");
      }
    },

    async setCommercialBillingLineState(ctx, input) {
      if (!authorized(ctx)) return fail("FORBIDDEN", "Owner or dispatcher access is required for commercial billing.");
      if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion <= 0 || !["INCLUDED", "EXCLUDED"].includes(input.state)) {
        return fail("COMMERCIAL_BILLING_LINE_INPUT_INVALID", "Commercial billing line update is invalid.");
      }

      const { data, error } = await client.rpc<RpcRow>("servicedesk_set_commercial_billing_line_state", {
        p_input: {
          workspaceId: ctx.workspaceId,
          actorUserId: ctx.userId,
          actorRole: ctx.role,
          draftId: input.draftId,
          lineId: input.lineId,
          state: input.state,
          expectedVersion: input.expectedVersion,
          now: input.now,
        },
      });
      if (error) return fail(error.code ?? "COMMERCIAL_BILLING_RPC_ERROR", error.message);
      if (!data || data.ok === false) return rpcFailure(data, "COMMERCIAL_BILLING_LINE_REJECTED");

      try {
        return { ok: true, value: mapDraft(data.draft, ctx.workspaceId) };
      } catch (error) {
        return fail("COMMERCIAL_BILLING_RPC_MALFORMED", error instanceof Error ? error.message : "Malformed commercial billing response.");
      }
    },

    async finalizeCommercialBillingDraft(ctx, input) {
      if (!authorized(ctx)) return fail("FORBIDDEN", "Owner or dispatcher access is required for commercial billing.");
      if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion <= 0) {
        return fail("COMMERCIAL_BILLING_FINALIZE_INPUT_INVALID", "Commercial billing draft version is invalid.");
      }

      const { data, error } = await client.rpc<RpcRow>("servicedesk_finalize_commercial_billing_draft", {
        p_input: {
          workspaceId: ctx.workspaceId,
          actorUserId: ctx.userId,
          actorRole: ctx.role,
          draftId: input.draftId,
          expectedVersion: input.expectedVersion,
          now: input.now,
        },
      });
      if (error) return fail(error.code ?? "COMMERCIAL_BILLING_RPC_ERROR", error.message);
      if (!data || data.ok === false) return rpcFailure(data, "COMMERCIAL_BILLING_FINALIZE_REJECTED");

      try {
        return {
          ok: true,
          value: {
            draft: mapDraft(data.draft, ctx.workspaceId),
            invoice: mapInvoice(data.invoice, ctx.workspaceId),
            duplicate: boolean(data, "duplicate"),
          },
        };
      } catch (error) {
        return fail("COMMERCIAL_BILLING_RPC_MALFORMED", error instanceof Error ? error.message : "Malformed commercial billing response.");
      }
    },
  };
}
