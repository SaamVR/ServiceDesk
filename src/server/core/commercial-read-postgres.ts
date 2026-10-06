import type {
  ActorContext,
  CommercialContractDTO,
  CommercialContractSiteDTO,
  CommercialContractVersionDTO,
  CommercialExceptionCaseDTO,
  CommercialOrganizationDTO,
  CommercialPortfolioContactDTO,
  CommercialPortfolioSnapshotDTO,
  CommercialSiteDTO,
  CommercialSiteServicePlanDTO,
  Result,
  WorkspaceFeatureFlagDTO,
} from "../../contracts";
import type { SupabaseRpcClient } from "./payment-application-postgres";

interface RpcRow { [key: string]: unknown }

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function object(value: unknown, key: string): RpcRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Malformed commercial snapshot: ${key}`);
  return value as RpcRow;
}

function list(value: unknown, key: string): RpcRow[] {
  if (!Array.isArray(value)) throw new Error(`Malformed commercial snapshot: ${key}`);
  return value.map((item, index) => object(item, `${key}[${index}]`));
}

function string(row: RpcRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Malformed commercial snapshot: ${key}`);
  return value;
}

function optionalString(row: RpcRow, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function number(row: RpcRow, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Malformed commercial snapshot: ${key}`);
  return value;
}

function optionalNumber(row: RpcRow, key: string): number | undefined {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function boolean(row: RpcRow, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") throw new Error(`Malformed commercial snapshot: ${key}`);
  return value;
}

function record(row: RpcRow, key: string): Record<string, unknown> {
  return object(row[key], key);
}

function optionalRecord(row: RpcRow, key: string): Record<string, unknown> | undefined {
  const value = row[key];
  return value == null ? undefined : object(value, key);
}

function mapFeature(row: RpcRow): WorkspaceFeatureFlagDTO {
  return {
    workspaceId: string(row, "workspaceId"),
    featureKey: string(row, "featureKey"),
    enabled: boolean(row, "enabled"),
    config: record(row, "config"),
    version: number(row, "version"),
    updatedAt: string(row, "updatedAt"),
  };
}

function mapOrganization(row: RpcRow): CommercialOrganizationDTO {
  return {
    id: string(row, "id"), workspaceId: string(row, "workspaceId"), displayName: string(row, "displayName"),
    legalName: optionalString(row, "legalName"), reference: optionalString(row, "reference"),
    status: string(row, "status") as CommercialOrganizationDTO["status"], version: number(row, "version"),
    createdAt: string(row, "createdAt"), updatedAt: string(row, "updatedAt"),
  };
}

function mapContact(row: RpcRow): CommercialPortfolioContactDTO {
  return {
    id: string(row, "id"), workspaceId: string(row, "workspaceId"), organizationId: string(row, "organizationId"),
    customerId: string(row, "customerId"), title: optionalString(row, "title"),
    authorizedRequester: boolean(row, "authorizedRequester"), billingContact: boolean(row, "billingContact"),
    operationsContact: boolean(row, "operationsContact"), createdAt: string(row, "createdAt"), updatedAt: string(row, "updatedAt"),
  };
}

function mapSite(row: RpcRow): CommercialSiteDTO {
  return {
    id: string(row, "id"), workspaceId: string(row, "workspaceId"), organizationId: string(row, "organizationId"),
    propertyId: string(row, "propertyId"), siteCode: optionalString(row, "siteCode"), active: boolean(row, "active"),
    version: number(row, "version"), createdAt: string(row, "createdAt"), updatedAt: string(row, "updatedAt"),
  };
}

function mapContract(row: RpcRow): CommercialContractDTO {
  return {
    id: string(row, "id"), workspaceId: string(row, "workspaceId"), organizationId: string(row, "organizationId"),
    contractNumber: string(row, "contractNumber"), status: string(row, "status") as CommercialContractDTO["status"],
    version: number(row, "version"), createdAt: string(row, "createdAt"), updatedAt: string(row, "updatedAt"),
  };
}

function mapContractVersion(row: RpcRow): CommercialContractVersionDTO {
  return {
    id: string(row, "id"), workspaceId: string(row, "workspaceId"), contractId: string(row, "contractId"),
    versionNumber: number(row, "versionNumber"), state: string(row, "state") as CommercialContractVersionDTO["state"],
    effectiveFrom: string(row, "effectiveFrom"), effectiveTo: optionalString(row, "effectiveTo"),
    currency: string(row, "currency") as CommercialContractVersionDTO["currency"], rateSnapshot: record(row, "rateSnapshot"),
    approvalAuthority: record(row, "approvalAuthority"), approvedByUserId: optionalString(row, "approvedByUserId"),
    approvedAt: optionalString(row, "approvedAt"), createdAt: string(row, "createdAt"),
  };
}

function mapContractSite(row: RpcRow): CommercialContractSiteDTO {
  return {
    id: string(row, "id"), workspaceId: string(row, "workspaceId"), contractVersionId: string(row, "contractVersionId"),
    siteId: string(row, "siteId"), serviceId: string(row, "serviceId"), scopeSnapshot: record(row, "scopeSnapshot"),
    serviceLevelTargetMinutes: optionalNumber(row, "serviceLevelTargetMinutes"), availabilitySnapshot: record(row, "availabilitySnapshot"),
    rateOverrideSnapshot: optionalRecord(row, "rateOverrideSnapshot"), active: boolean(row, "active"), createdAt: string(row, "createdAt"),
  };
}

function mapServicePlan(row: RpcRow): CommercialSiteServicePlanDTO {
  return {
    id: string(row, "id"), workspaceId: string(row, "workspaceId"), contractVersionId: string(row, "contractVersionId"),
    contractSiteId: string(row, "contractSiteId"), recurrenceRuleId: optionalString(row, "recurrenceRuleId"),
    frequency: string(row, "frequency") as CommercialSiteServicePlanDTO["frequency"], timezone: string(row, "timezone"),
    localStartTime: string(row, "localStartTime"), startsOn: string(row, "startsOn"), endsOn: optionalString(row, "endsOn"),
    preferredWindowStart: optionalString(row, "preferredWindowStart"), preferredWindowEnd: optionalString(row, "preferredWindowEnd"),
    status: string(row, "status") as CommercialSiteServicePlanDTO["status"], version: number(row, "version"),
    createdAt: string(row, "createdAt"), updatedAt: string(row, "updatedAt"),
  };
}

function mapException(row: RpcRow): CommercialExceptionCaseDTO {
  return {
    id: string(row, "id"), workspaceId: string(row, "workspaceId"), organizationId: string(row, "organizationId"),
    contractId: string(row, "contractId"), contractVersionId: optionalString(row, "contractVersionId"), siteId: string(row, "siteId"),
    visitId: optionalString(row, "visitId"), type: string(row, "type") as CommercialExceptionCaseDTO["type"],
    state: string(row, "state") as CommercialExceptionCaseDTO["state"], summary: string(row, "summary"),
    ownerUserId: optionalString(row, "ownerUserId"), requestedAdjustmentKind: optionalString(row, "requestedAdjustmentKind") as CommercialExceptionCaseDTO["requestedAdjustmentKind"],
    requestedAdjustmentMinor: optionalNumber(row, "requestedAdjustmentMinor"),
    requestedAdjustmentCurrency: optionalString(row, "requestedAdjustmentCurrency") as CommercialExceptionCaseDTO["requestedAdjustmentCurrency"],
    resolutionNote: optionalString(row, "resolutionNote"), version: number(row, "version"),
    createdAt: string(row, "createdAt"), updatedAt: string(row, "updatedAt"),
  };
}

function assertWorkspace(snapshot: CommercialPortfolioSnapshotDTO, workspaceId: string): CommercialPortfolioSnapshotDTO {
  const rows = [
    snapshot.feature,
    ...snapshot.organizations,
    ...snapshot.contacts,
    ...snapshot.sites,
    ...snapshot.contracts,
    ...snapshot.contractVersions,
    ...snapshot.contractSites,
    ...snapshot.servicePlans,
    ...snapshot.exceptionCases,
  ];
  if (snapshot.workspaceId !== workspaceId || rows.some((item) => item.workspaceId !== workspaceId)) {
    throw new Error("Commercial snapshot contained a cross-workspace row.");
  }
  if (snapshot.feature.featureKey !== "COMMERCIAL_OPERATIONS" || !snapshot.feature.enabled) {
    throw new Error("Commercial snapshot feature state was invalid.");
  }
  return snapshot;
}

function mapSnapshot(value: unknown, workspaceId: string): CommercialPortfolioSnapshotDTO {
  const src = object(value, "snapshot");
  return assertWorkspace({
    workspaceId: string(src, "workspaceId"),
    feature: mapFeature(object(src.feature, "feature")),
    organizations: list(src.organizations, "organizations").map(mapOrganization),
    contacts: list(src.contacts, "contacts").map(mapContact),
    sites: list(src.sites, "sites").map(mapSite),
    contracts: list(src.contracts, "contracts").map(mapContract),
    contractVersions: list(src.contractVersions, "contractVersions").map(mapContractVersion),
    contractSites: list(src.contractSites, "contractSites").map(mapContractSite),
    servicePlans: list(src.servicePlans, "servicePlans").map(mapServicePlan),
    exceptionCases: list(src.exceptionCases, "exceptionCases").map(mapException),
  }, workspaceId);
}

export interface CommercialPortfolioReader {
  readCommercialPortfolioSnapshot(ctx: ActorContext): Promise<Result<CommercialPortfolioSnapshotDTO>>;
}

export function createPostgresCommercialPortfolioReader(client: SupabaseRpcClient): CommercialPortfolioReader {
  return {
    async readCommercialPortfolioSnapshot(ctx: ActorContext): Promise<Result<CommercialPortfolioSnapshotDTO>> {
      if (!ctx.userId || !["OWNER", "DISPATCHER"].includes(ctx.role)) {
        return fail("FORBIDDEN", "Owner or dispatcher access is required for commercial operations.");
      }
      const { data, error } = await client.rpc<RpcRow>("servicedesk_read_commercial_portfolio_snapshot", {
        p_input: { workspaceId: ctx.workspaceId, actorUserId: ctx.userId, actorRole: ctx.role },
      });
      if (error) return fail(error.code ?? "COMMERCIAL_READ_RPC_ERROR", error.message);
      if (!data) return fail("COMMERCIAL_READ_RPC_EMPTY", "Commercial portfolio RPC returned no payload.");
      if (data.ok === false) return fail(String(data.code ?? "COMMERCIAL_READ_REJECTED"), "Commercial portfolio read was rejected.");
      try {
        return { ok: true, value: mapSnapshot(data.snapshot, ctx.workspaceId) };
      } catch (err) {
        return fail("COMMERCIAL_READ_MALFORMED", err instanceof Error ? err.message : "Commercial portfolio RPC returned malformed data.");
      }
    },
  };
}
