import type {
  AccountingBackfillCandidateDTO,
  AccountingBackfillPlanDTO,
  AccountingIntegrationDTO,
  AccountingIntegrationStatus,
  AccountingLocalResourceKind,
  AccountingReconciliationRecordDTO,
  AccountingReconciliationSnapshotDTO,
  AccountingReconciliationState,
  AccountingSyncOwner,
  AccountingEntityType,
  ActorContext,
  Result,
} from "../../contracts";
import type { SupabaseRpcClient } from "./payment-application-postgres";

type RpcRow = Record<string, unknown>;

export interface SetAccountingIntegrationStateInput {
  workspaceId: string;
  provider: string;
  status: AccountingIntegrationStatus;
  defaultSyncOwner: AccountingSyncOwner;
  lastErrorCode?: string;
  now: string;
}

export interface RecordAccountingReconciliationInput {
  workspaceId: string;
  provider: string;
  entityType: AccountingEntityType;
  localResourceKind: AccountingLocalResourceKind;
  localResourceId: string;
  localVersion: number;
  externalId?: string;
  externalVersion?: string;
  syncOwner: AccountingSyncOwner;
  state: AccountingReconciliationState;
  lastErrorCode?: string;
  idempotencyKey: string;
  payloadFingerprint: string;
  now: string;
}

export interface AccountingReconciliationReader {
  readAccountingReconciliationSnapshot(
    ctx: ActorContext,
  ): Promise<Result<AccountingReconciliationSnapshotDTO>>;
  planAccountingBackfill(
    ctx: ActorContext,
    provider: string,
    limit?: number,
  ): Promise<Result<AccountingBackfillPlanDTO>>;
}

export interface AccountingReconciliationRecorder {
  setAccountingIntegrationState(
    input: SetAccountingIntegrationStateInput,
  ): Promise<Result<AccountingIntegrationDTO>>;
  recordAccountingReconciliation(
    input: RecordAccountingReconciliationInput,
  ): Promise<Result<{ record: AccountingReconciliationRecordDTO; duplicate: boolean }>>;
}

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function object(value: unknown, key: string): RpcRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Malformed accounting reconciliation payload: ${key}`);
  }
  return value as RpcRow;
}

function list(value: unknown, key: string): RpcRow[] {
  if (!Array.isArray(value)) throw new Error(`Malformed accounting reconciliation payload: ${key}`);
  return value.map((item, index) => object(item, `${key}[${index}]`));
}

function string(row: RpcRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Malformed accounting reconciliation payload: ${key}`);
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
    throw new Error(`Malformed accounting reconciliation payload: ${key}`);
  }
  return value;
}

function oneOf<T extends string>(value: string, allowed: readonly T[], key: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`Malformed accounting reconciliation payload: ${key}=${value}`);
  }
  return value as T;
}

const integrationStatuses = ["DISCONNECTED", "READY", "AUTH_EXPIRED", "ERROR"] as const;
const syncOwners = ["SERVICEDESK", "EXTERNAL"] as const;
const entityTypes = ["CONTACT", "INVOICE", "PAYMENT", "CREDIT"] as const;
const localKinds = [
  "COMMERCIAL_ORGANIZATION",
  "INVOICE",
  "VERIFIED_PAYMENT",
  "MANUAL_PAYMENT",
  "COMMERCIAL_BILLING_LINE",
] as const;
const states = ["PENDING", "SYNCED", "CONFLICT", "ERROR"] as const;
const backfillReasons = ["UNTRACKED", "LOCAL_VERSION_ADVANCED"] as const;

function mapIntegration(row: RpcRow): AccountingIntegrationDTO {
  return {
    id: string(row, "id"),
    workspaceId: string(row, "workspaceId"),
    provider: string(row, "provider"),
    status: oneOf(string(row, "status"), integrationStatuses, "status"),
    defaultSyncOwner: oneOf(string(row, "defaultSyncOwner"), syncOwners, "defaultSyncOwner"),
    lastSuccessAt: optionalString(row, "lastSuccessAt"),
    lastErrorCode: optionalString(row, "lastErrorCode"),
    version: number(row, "version"),
    createdAt: string(row, "createdAt"),
    updatedAt: string(row, "updatedAt"),
  };
}

function mapRecord(row: RpcRow): AccountingReconciliationRecordDTO {
  return {
    id: string(row, "id"),
    workspaceId: string(row, "workspaceId"),
    integrationId: string(row, "integrationId"),
    entityType: oneOf(string(row, "entityType"), entityTypes, "entityType"),
    localResourceKind: oneOf(string(row, "localResourceKind"), localKinds, "localResourceKind"),
    localResourceId: string(row, "localResourceId"),
    localVersion: number(row, "localVersion"),
    externalId: optionalString(row, "externalId"),
    externalVersion: optionalString(row, "externalVersion"),
    syncOwner: oneOf(string(row, "syncOwner"), syncOwners, "syncOwner"),
    state: oneOf(string(row, "state"), states, "state"),
    lastErrorCode: optionalString(row, "lastErrorCode"),
    idempotencyKey: string(row, "idempotencyKey"),
    payloadFingerprint: string(row, "payloadFingerprint"),
    syncedAt: optionalString(row, "syncedAt"),
    version: number(row, "version"),
    createdAt: string(row, "createdAt"),
    updatedAt: string(row, "updatedAt"),
  };
}

function mapSnapshot(value: unknown, workspaceId: string): AccountingReconciliationSnapshotDTO {
  const row = object(value, "snapshot");
  const snapshot: AccountingReconciliationSnapshotDTO = {
    workspaceId: string(row, "workspaceId"),
    integrations: list(row.integrations, "integrations").map(mapIntegration),
    records: list(row.records, "records").map(mapRecord),
    pendingCount: number(row, "pendingCount"),
    conflictCount: number(row, "conflictCount"),
    errorCount: number(row, "errorCount"),
  };

  if (
    snapshot.workspaceId !== workspaceId
    || snapshot.integrations.some((integration) => integration.workspaceId !== workspaceId)
    || snapshot.records.some((record) => record.workspaceId !== workspaceId)
  ) {
    throw new Error("Accounting reconciliation payload contained a cross-workspace row.");
  }

  const integrationIds = new Set(snapshot.integrations.map((integration) => integration.id));
  if (snapshot.records.some((record) => !integrationIds.has(record.integrationId))) {
    throw new Error("Accounting reconciliation payload referenced an unknown integration.");
  }
  return snapshot;
}

function mapBackfillCandidate(row: RpcRow): AccountingBackfillCandidateDTO {
  return {
    entityType: oneOf(string(row, "entityType"), entityTypes, "entityType"),
    localResourceKind: oneOf(string(row, "localResourceKind"), localKinds, "localResourceKind"),
    localResourceId: string(row, "localResourceId"),
    localVersion: number(row, "localVersion"),
    reason: oneOf(string(row, "reason"), backfillReasons, "reason"),
  };
}

function mapBackfillPlan(value: unknown, workspaceId: string, provider: string): AccountingBackfillPlanDTO {
  const row = object(value, "plan");
  const plan: AccountingBackfillPlanDTO = {
    workspaceId: string(row, "workspaceId"),
    provider: string(row, "provider"),
    dryRun: row.dryRun === true,
    candidateCount: number(row, "candidateCount"),
    blockedCount: number(row, "blockedCount"),
    pendingCount: number(row, "pendingCount"),
    currentCount: number(row, "currentCount"),
    candidates: list(row.candidates, "candidates").map(mapBackfillCandidate),
  };

  if (!plan.dryRun) throw new Error("Accounting backfill plan was not marked as a dry run.");
  if (plan.workspaceId !== workspaceId || plan.provider !== provider) {
    throw new Error("Accounting backfill plan crossed workspace or provider scope.");
  }
  return plan;
}

function rpcFailure<T>(data: RpcRow | null, fallback: string): Result<T> {
  return fail(
    String(data?.code ?? fallback),
    "Accounting reconciliation command was rejected by the authoritative database boundary.",
  );
}

export function createPostgresAccountingReconciliationReader(
  client: SupabaseRpcClient,
): AccountingReconciliationReader {
  return {
    async readAccountingReconciliationSnapshot(ctx) {
      if (!ctx.userId || !["OWNER", "DISPATCHER"].includes(ctx.role)) {
        return fail("FORBIDDEN", "Owner or dispatcher access is required for accounting reconciliation.");
      }

      const { data, error } = await client.rpc<RpcRow>(
        "servicedesk_read_accounting_reconciliation_snapshot",
        {
          p_input: {
            workspaceId: ctx.workspaceId,
            actorUserId: ctx.userId,
            actorRole: ctx.role,
          },
        },
      );

      if (error) return fail(error.code ?? "ACCOUNTING_RECONCILIATION_READ_ERROR", error.message);
      if (!data) return fail("ACCOUNTING_RECONCILIATION_READ_EMPTY", "Accounting reconciliation read returned no payload.");
      if (data.ok === false) return rpcFailure(data, "ACCOUNTING_RECONCILIATION_READ_REJECTED");

      try {
        return { ok: true, value: mapSnapshot(data.snapshot, ctx.workspaceId) };
      } catch (error) {
        return fail(
          "ACCOUNTING_RECONCILIATION_READ_MALFORMED",
          error instanceof Error ? error.message : "Malformed accounting reconciliation response.",
        );
      }
    },

    async planAccountingBackfill(ctx, provider, limit = 100) {
      if (!ctx.userId || !["OWNER", "DISPATCHER"].includes(ctx.role)) {
        return fail("FORBIDDEN", "Owner or dispatcher access is required for accounting backfill planning.");
      }
      if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(provider) || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
        return fail("ACCOUNTING_BACKFILL_INPUT_INVALID", "Accounting backfill plan input is invalid.");
      }

      const { data, error } = await client.rpc<RpcRow>(
        "servicedesk_plan_accounting_backfill",
        {
          p_input: {
            workspaceId: ctx.workspaceId,
            actorUserId: ctx.userId,
            actorRole: ctx.role,
            provider,
            limit,
          },
        },
      );

      if (error) return fail(error.code ?? "ACCOUNTING_BACKFILL_READ_ERROR", error.message);
      if (!data) return fail("ACCOUNTING_BACKFILL_READ_EMPTY", "Accounting backfill planner returned no payload.");
      if (data.ok === false) return rpcFailure(data, "ACCOUNTING_BACKFILL_REJECTED");

      try {
        return { ok: true, value: mapBackfillPlan(data.plan, ctx.workspaceId, provider) };
      } catch (error) {
        return fail(
          "ACCOUNTING_BACKFILL_READ_MALFORMED",
          error instanceof Error ? error.message : "Malformed accounting backfill response.",
        );
      }
    },
  };
}

export function createPostgresAccountingReconciliationRecorder(
  client: SupabaseRpcClient,
): AccountingReconciliationRecorder {
  return {
    async setAccountingIntegrationState(input) {
      const { data, error } = await client.rpc<RpcRow>(
        "servicedesk_set_accounting_integration_state",
        { p_input: input },
      );

      if (error) return fail(error.code ?? "ACCOUNTING_INTEGRATION_RPC_ERROR", error.message);
      if (!data || data.ok === false) return rpcFailure(data, "ACCOUNTING_INTEGRATION_REJECTED");

      try {
        const integration = mapIntegration(object(data.integration, "integration"));
        if (integration.workspaceId !== input.workspaceId) {
          throw new Error("Accounting integration crossed workspace scope.");
        }
        return { ok: true, value: integration };
      } catch (error) {
        return fail(
          "ACCOUNTING_INTEGRATION_RPC_MALFORMED",
          error instanceof Error ? error.message : "Malformed accounting integration response.",
        );
      }
    },

    async recordAccountingReconciliation(input) {
      const { data, error } = await client.rpc<RpcRow>(
        "servicedesk_record_accounting_reconciliation",
        { p_input: input },
      );

      if (error) return fail(error.code ?? "ACCOUNTING_RECONCILIATION_RPC_ERROR", error.message);
      if (!data || data.ok === false) return rpcFailure(data, "ACCOUNTING_RECONCILIATION_REJECTED");

      try {
        const record = mapRecord(object(data.record, "record"));
        if (record.workspaceId !== input.workspaceId) {
          throw new Error("Accounting reconciliation record crossed workspace scope.");
        }
        return {
          ok: true,
          value: {
            record,
            duplicate: data.duplicate === true,
          },
        };
      } catch (error) {
        return fail(
          "ACCOUNTING_RECONCILIATION_RPC_MALFORMED",
          error instanceof Error ? error.message : "Malformed accounting reconciliation response.",
        );
      }
    },
  };
}
