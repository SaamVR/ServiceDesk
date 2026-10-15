import type {
  ActorContext,
  CommercialProfitabilityAdjustmentTotalDTO,
  CommercialProfitabilityRowDTO,
  CommercialProfitabilitySnapshotDTO,
  Result,
} from "../../contracts";
import type { SupabaseRpcClient } from "./payment-application-postgres";

type RpcRow = Record<string, unknown>;

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function object(value: unknown, key: string): RpcRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Malformed commercial profitability payload: ${key}`);
  }
  return value as RpcRow;
}

function list(value: unknown, key: string): RpcRow[] {
  if (!Array.isArray(value)) throw new Error(`Malformed commercial profitability payload: ${key}`);
  return value.map((item, index) => object(item, `${key}[${index}]`));
}

function string(row: RpcRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Malformed commercial profitability payload: ${key}`);
  }
  return value;
}

function optionalString(row: RpcRow, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
function currency(row: RpcRow, key: string): string {
  const value = string(row, key);
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new Error("Malformed commercial profitability payload: currency");
  }
  return value;
}

function minor(row: RpcRow, key: string): number {
  const value = row[key];
  // PostgreSQL returns integer minor units; a fractional/unsafe value must
  // never be presented as an authoritative commercial amount.
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`Malformed commercial profitability payload: ${key}`);
  }
  return value;
}
function count(row: RpcRow, key: string): number {
  const value = minor(row, key);
  if (value < 0) throw new Error(`Malformed commercial profitability payload: ${key}`);
  return value;
}

function mapRow(row: RpcRow): CommercialProfitabilityRowDTO {
  const quotedRevenueMinor = minor(row, "quotedRevenueMinor");
  const completedRevenueMinor = minor(row, "completedRevenueMinor");
  const paidRevenueMinor = minor(row, "paidRevenueMinor");
  const recordedEstimatedCostMinor = minor(row, "recordedEstimatedCostMinor");
  const recordedActualCompletedCostMinor = minor(row, "recordedActualCompletedCostMinor");
  const recordedActualPaidCostMinor = minor(row, "recordedActualPaidCostMinor");
  const recordedQuotedMarginMinor = minor(row, "recordedQuotedMarginMinor");
  const recordedCompletedMarginMinor = minor(row, "recordedCompletedMarginMinor");
  const recordedPaidMarginMinor = minor(row, "recordedPaidMarginMinor");
  if (!Number.isSafeInteger(quotedRevenueMinor - recordedEstimatedCostMinor) ||
      !Number.isSafeInteger(completedRevenueMinor - recordedActualCompletedCostMinor) ||
      !Number.isSafeInteger(paidRevenueMinor - recordedActualPaidCostMinor) ||
      recordedQuotedMarginMinor !== quotedRevenueMinor - recordedEstimatedCostMinor ||
      recordedCompletedMarginMinor !== completedRevenueMinor - recordedActualCompletedCostMinor ||
      recordedPaidMarginMinor !== paidRevenueMinor - recordedActualPaidCostMinor) {
    throw new Error("Malformed commercial profitability payload: margin mismatch");
  }
  return {
    siteId: string(row, "siteId"),
    siteCode: optionalString(row, "siteCode"),
    serviceId: string(row, "serviceId"),
    serviceCode: string(row, "serviceCode"),
    serviceName: string(row, "serviceName"),
    currency: currency(row, "currency") as CommercialProfitabilityRowDTO["currency"],
    quotedVisitCount: count(row, "quotedVisitCount"),
    completedVisitCount: count(row, "completedVisitCount"),
    paidVisitCount: count(row, "paidVisitCount"),
    unresolvedRateCount: count(row, "unresolvedRateCount"),
    estimatedCostedVisitCount: count(row, "estimatedCostedVisitCount"),
    actualCostedCompletedVisitCount: count(row, "actualCostedCompletedVisitCount"),
    actualCostedPaidVisitCount: count(row, "actualCostedPaidVisitCount"),
    partialPaymentVisitCount: count(row, "partialPaymentVisitCount"),
    quotedRevenueMinor,
    completedRevenueMinor,
    paidRevenueMinor,
    recordedEstimatedCostMinor,
    recordedActualCompletedCostMinor,
    recordedActualPaidCostMinor,
    recordedQuotedMarginMinor,
    recordedCompletedMarginMinor,
    recordedPaidMarginMinor,
  };
}

function mapAdjustment(row: RpcRow): CommercialProfitabilityAdjustmentTotalDTO {
  return {
    currency: currency(row, "currency") as CommercialProfitabilityAdjustmentTotalDTO["currency"],
    finalizedNetMinor: minor(row, "finalizedNetMinor"),
    paidNetMinor: minor(row, "paidNetMinor"),
    lineCount: count(row, "lineCount"),
  };
}

function mapSnapshot(value: unknown, workspaceId: string): CommercialProfitabilitySnapshotDTO {
  const row = object(value, "snapshot");
  const snapshot: CommercialProfitabilitySnapshotDTO = {
    workspaceId: string(row, "workspaceId"),
    fromDate: optionalString(row, "fromDate"),
    toDate: optionalString(row, "toDate"),
    rows: list(row.rows, "rows").map(mapRow),
    unattributedAdjustments: list(row.unattributedAdjustments, "unattributedAdjustments").map(mapAdjustment),
    partialPaymentInvoiceCount: count(row, "partialPaymentInvoiceCount"),
  };

  if (snapshot.workspaceId !== workspaceId) {
    throw new Error("Commercial profitability payload crossed workspace scope.");
  }
  return snapshot;
}

export interface CommercialProfitabilityReader {
  readCommercialProfitabilitySnapshot(
    ctx: ActorContext,
    query?: { fromDate?: string; toDate?: string },
  ): Promise<Result<CommercialProfitabilitySnapshotDTO>>;
}

export function createPostgresCommercialProfitabilityReader(
  client: SupabaseRpcClient,
): CommercialProfitabilityReader {
  return {
    async readCommercialProfitabilitySnapshot(ctx, query = {}) {
      if (!ctx.userId || !["OWNER", "DISPATCHER"].includes(ctx.role)) {
        return fail("FORBIDDEN", "Owner or dispatcher access is required for commercial profitability.");
      }

      const { data, error } = await client.rpc<RpcRow>(
        "servicedesk_read_commercial_profitability_snapshot",
        {
          p_input: {
            workspaceId: ctx.workspaceId,
            actorUserId: ctx.userId,
            actorRole: ctx.role,
            fromDate: query.fromDate,
            toDate: query.toDate,
          },
        },
      );

      if (error) return fail(error.code ?? "COMMERCIAL_PROFITABILITY_READ_ERROR", error.message);
      if (!data) return fail("COMMERCIAL_PROFITABILITY_READ_EMPTY", "Commercial profitability read returned no payload.");
      if (data.ok === false) {
        return fail(
          String(data.code ?? "COMMERCIAL_PROFITABILITY_READ_REJECTED"),
          "Commercial profitability read was rejected.",
        );
      }

      try {
        return { ok: true, value: mapSnapshot(data.snapshot, ctx.workspaceId) };
      } catch (error) {
        return fail(
          "COMMERCIAL_PROFITABILITY_READ_MALFORMED",
          error instanceof Error ? error.message : "Malformed commercial profitability response.",
        );
      }
    },
  };
}
