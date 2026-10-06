import type {
  ActorContext,
  CommercialDirectCostBasis,
  CommercialDirectCostCategory,
  CommercialDirectCostDTO,
  CommercialDirectCostDirection,
  CommercialDirectCostSnapshotDTO,
  CommercialDirectCostSourceKind,
  CommercialDirectCostTotalDTO,
  Result,
} from "../../contracts";
import type { SupabaseRpcClient } from "./payment-application-postgres";

type RpcRow = Record<string, unknown>;

export interface RecordCommercialDirectCostInput {
  visitId: string;
  category: CommercialDirectCostCategory;
  basis: CommercialDirectCostBasis;
  direction: CommercialDirectCostDirection;
  amountMinor: number;
  currency: string;
  sourceKind: CommercialDirectCostSourceKind;
  sourceReference?: string;
  reversesEntryId?: string;
  idempotencyKey: string;
  occurredAt: string;
  now: string;
}

export interface CommercialDirectCostReader {
  readCommercialDirectCostSnapshot(
    ctx: ActorContext,
    query?: { from?: string; to?: string },
  ): Promise<Result<CommercialDirectCostSnapshotDTO>>;
}

export interface CommercialDirectCostRecorder {
  recordCommercialDirectCost(
    ctx: ActorContext,
    input: RecordCommercialDirectCostInput,
  ): Promise<Result<{ entry: CommercialDirectCostDTO; duplicate: boolean }>>;
}

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function object(value: unknown, key: string): RpcRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Malformed commercial direct cost payload: ${key}`);
  }
  return value as RpcRow;
}

function list(value: unknown, key: string): RpcRow[] {
  if (!Array.isArray(value)) throw new Error(`Malformed commercial direct cost payload: ${key}`);
  return value.map((item, index) => object(item, `${key}[${index}]`));
}

function string(row: RpcRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Malformed commercial direct cost payload: ${key}`);
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
    throw new Error(`Malformed commercial direct cost payload: ${key}`);
  }
  return value;
}

function oneOf<T extends string>(value: string, allowed: readonly T[], key: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`Malformed commercial direct cost payload: ${key}=${value}`);
  }
  return value as T;
}

const categories = ["LABOR", "SUPPLIES", "TRAVEL"] as const;
const bases = ["ESTIMATED", "ACTUAL"] as const;
const directions = ["COST", "REVERSAL"] as const;
const sourceKinds = ["MANUAL", "CREW_RATE", "SUPPLY", "TRAVEL"] as const;

function mapEntry(value: unknown): CommercialDirectCostDTO {
  const row = object(value, "entry");
  return {
    id: string(row, "id"),
    workspaceId: string(row, "workspaceId"),
    visitId: string(row, "visitId"),
    contractVersionId: string(row, "contractVersionId"),
    siteId: string(row, "siteId"),
    serviceId: string(row, "serviceId"),
    category: oneOf(string(row, "category"), categories, "category"),
    basis: oneOf(string(row, "basis"), bases, "basis"),
    direction: oneOf(string(row, "direction"), directions, "direction"),
    amountMinor: number(row, "amountMinor"),
    currency: string(row, "currency") as CommercialDirectCostDTO["currency"],
    sourceKind: oneOf(string(row, "sourceKind"), sourceKinds, "sourceKind"),
    sourceReference: optionalString(row, "sourceReference"),
    reversesEntryId: optionalString(row, "reversesEntryId"),
    occurredAt: string(row, "occurredAt"),
    createdAt: string(row, "createdAt"),
  };
}

function mapTotal(row: RpcRow): CommercialDirectCostTotalDTO {
  return {
    currency: string(row, "currency") as CommercialDirectCostTotalDTO["currency"],
    category: oneOf(string(row, "category"), categories, "category"),
    basis: oneOf(string(row, "basis"), bases, "basis"),
    netMinor: number(row, "netMinor"),
  };
}

function mapSnapshot(value: unknown, workspaceId: string): CommercialDirectCostSnapshotDTO {
  const row = object(value, "snapshot");
  const snapshot: CommercialDirectCostSnapshotDTO = {
    workspaceId: string(row, "workspaceId"),
    entries: list(row.entries, "entries").map(mapEntry),
    totals: list(row.totals, "totals").map(mapTotal),
  };

  if (
    snapshot.workspaceId !== workspaceId
    || snapshot.entries.some((entry) => entry.workspaceId !== workspaceId)
  ) {
    throw new Error("Commercial direct cost payload contained a cross-workspace row.");
  }
  return snapshot;
}

function authorized(ctx: ActorContext): boolean {
  return Boolean(ctx.userId) && (ctx.role === "OWNER" || ctx.role === "DISPATCHER");
}

function validInput(input: RecordCommercialDirectCostInput): boolean {
  const categoryOk = categories.includes(input.category);
  const basisOk = bases.includes(input.basis);
  const directionOk = directions.includes(input.direction);
  const sourceOk = sourceKinds.includes(input.sourceKind);
  const currencyOk = /^[A-Z]{3}$/.test(input.currency);
  const amountOk = Number.isSafeInteger(input.amountMinor) && input.amountMinor > 0;
  const idempotencyOk = input.idempotencyKey.trim().length >= 8 && input.idempotencyKey.trim().length <= 160;
  const reversalOk = input.direction === "REVERSAL" ? Boolean(input.reversesEntryId) : !input.reversesEntryId;
  return categoryOk && basisOk && directionOk && sourceOk && currencyOk && amountOk && idempotencyOk && reversalOk;
}

export function createPostgresCommercialDirectCostPort(
  client: SupabaseRpcClient,
): CommercialDirectCostReader & CommercialDirectCostRecorder {
  return {
    async readCommercialDirectCostSnapshot(ctx, query = {}) {
      if (!authorized(ctx)) {
        return fail("FORBIDDEN", "Owner or dispatcher access is required for commercial direct costs.");
      }

      const { data, error } = await client.rpc<RpcRow>(
        "servicedesk_read_commercial_direct_cost_snapshot",
        {
          p_input: {
            workspaceId: ctx.workspaceId,
            actorUserId: ctx.userId,
            actorRole: ctx.role,
            from: query.from,
            to: query.to,
          },
        },
      );

      if (error) return fail(error.code ?? "COMMERCIAL_DIRECT_COST_READ_ERROR", error.message);
      if (!data) return fail("COMMERCIAL_DIRECT_COST_READ_EMPTY", "Commercial direct cost read returned no payload.");
      if (data.ok === false) {
        return fail(String(data.code ?? "COMMERCIAL_DIRECT_COST_READ_REJECTED"), "Commercial direct cost read was rejected.");
      }

      try {
        return { ok: true, value: mapSnapshot(data.snapshot, ctx.workspaceId) };
      } catch (error) {
        return fail(
          "COMMERCIAL_DIRECT_COST_READ_MALFORMED",
          error instanceof Error ? error.message : "Malformed commercial direct cost response.",
        );
      }
    },

    async recordCommercialDirectCost(ctx, input) {
      if (!authorized(ctx)) {
        return fail("FORBIDDEN", "Owner or dispatcher access is required for commercial direct costs.");
      }
      if (!validInput(input)) {
        return fail("COMMERCIAL_DIRECT_COST_INPUT_INVALID", "Commercial direct cost input is invalid.");
      }

      const { data, error } = await client.rpc<RpcRow>(
        "servicedesk_record_commercial_direct_cost",
        {
          p_input: {
            workspaceId: ctx.workspaceId,
            actorUserId: ctx.userId,
            actorRole: ctx.role,
            ...input,
          },
        },
      );

      if (error) return fail(error.code ?? "COMMERCIAL_DIRECT_COST_RPC_ERROR", error.message);
      if (!data || data.ok === false) {
        return fail(
          String(data?.code ?? "COMMERCIAL_DIRECT_COST_REJECTED"),
          "Commercial direct cost command was rejected by the authoritative database boundary.",
        );
      }

      try {
        const entry = mapEntry(data.entry);
        if (entry.workspaceId !== ctx.workspaceId) {
          throw new Error("Commercial direct cost entry crossed workspace scope.");
        }
        return {
          ok: true,
          value: {
            entry,
            duplicate: data.duplicate === true,
          },
        };
      } catch (error) {
        return fail(
          "COMMERCIAL_DIRECT_COST_RPC_MALFORMED",
          error instanceof Error ? error.message : "Malformed commercial direct cost command response.",
        );
      }
    },
  };
}
