import type {
  ActorContext,
  OwnerSettingsSnapshotDTO,
  PlatformBillingSnapshotDTO,
  ReportingSnapshotDTO,
  Result,
} from "../../contracts";
import type { ReportingSnapshotQuery, ServiceDeskFacade } from "./facade";
import type { SupabaseRpcClient } from "./payment-application-postgres";

type RpcRow = Record<string, unknown>;

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function row(value: unknown): RpcRow | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RpcRow) : undefined;
}

function expectObject(value: unknown, key: string): RpcRow {
  const parsed = row(value);
  if (!parsed) throw new Error(`Malformed RPC payload: ${key}`);
  return parsed;
}

function expectString(value: unknown, key: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`Malformed RPC payload: ${key}`);
  return value;
}

function maybeString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function expectNumber(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Malformed RPC payload: ${key}`);
  return value;
}

function maybeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function rows(value: unknown): RpcRow[] {
  return Array.isArray(value) ? value.flatMap((item) => (row(item) ? [item as RpcRow] : [])) : [];
}

function mapReporting(value: unknown): ReportingSnapshotDTO {
  const src = expectObject(value, "snapshot");
  return {
    workspaceId: expectString(src.workspaceId, "workspaceId"),
    from: maybeString(src.from),
    to: maybeString(src.to),
    requestCount: expectNumber(src.requestCount, "requestCount"),
    bookedRequestCount: expectNumber(src.bookedRequestCount, "bookedRequestCount"),
    conversionRateBps: maybeNumber(src.conversionRateBps),
    collectedMinor: expectNumber(src.collectedMinor, "collectedMinor"),
    outstandingMinor: expectNumber(src.outstandingMinor, "outstandingMinor"),
    currency: maybeString(src.currency) as ReportingSnapshotDTO["currency"],
    scheduledServiceMinutes: expectNumber(src.scheduledServiceMinutes, "scheduledServiceMinutes"),
    scheduledBufferMinutes: expectNumber(src.scheduledBufferMinutes, "scheduledBufferMinutes"),
    openAttentionCount: expectNumber(src.openAttentionCount, "openAttentionCount"),
    unresolvedQualityCount: expectNumber(src.unresolvedQualityCount, "unresolvedQualityCount"),
    generatedAt: expectString(src.generatedAt, "generatedAt"),
  };
}

function mapPlatformBilling(value: unknown): PlatformBillingSnapshotDTO {
  const src = expectObject(value, "snapshot");
  const sub = expectObject(src.subscription, "subscription");
  return {
    workspaceId: expectString(src.workspaceId, "workspaceId"),
    subscription: {
      workspaceId: expectString(sub.workspaceId, "subscription.workspaceId"),
      plan: expectString(sub.plan, "subscription.plan") as PlatformBillingSnapshotDTO["subscription"]["plan"],
      status: expectString(sub.status, "subscription.status") as PlatformBillingSnapshotDTO["subscription"]["status"],
      providerMode: expectString(sub.providerMode, "subscription.providerMode") as PlatformBillingSnapshotDTO["subscription"]["providerMode"],
      trialEndsAt: maybeString(sub.trialEndsAt),
      currentPeriodEndsAt: maybeString(sub.currentPeriodEndsAt),
      version: expectNumber(sub.version, "subscription.version"),
      updatedAt: expectString(sub.updatedAt, "subscription.updatedAt"),
    },
    usage: rows(src.usage).map((metric) => ({
      metric: expectString(metric.metric, "usage.metric") as PlatformBillingSnapshotDTO["usage"][number]["metric"],
      used: expectNumber(metric.used, "usage.used"),
      limit: maybeNumber(metric.limit),
      state: expectString(metric.state, "usage.state") as PlatformBillingSnapshotDTO["usage"][number]["state"],
    })),
  };
}

function mapOwnerSettings(value: unknown): OwnerSettingsSnapshotDTO {
  const src = expectObject(value, "snapshot");
  return {
    workspaceId: expectString(src.workspaceId, "workspaceId"),
    services: rows(src.services).map((service) => ({
      code: expectString(service.code, "service.code"),
      label: expectString(service.label, "service.label"),
      enabled: service.enabled === true,
    })),
    members: rows(src.members).map((member) => ({
      userId: expectString(member.userId, "member.userId"),
      role: expectString(member.role, "member.role") as OwnerSettingsSnapshotDTO["members"][number]["role"],
      active: member.active === true,
    })),
    invitations: rows(src.invitations).map((invitation) => ({
      id: expectString(invitation.id, "invitation.id"),
      email: maybeString(invitation.email),
      role: expectString(invitation.role, "invitation.role") as OwnerSettingsSnapshotDTO["invitations"][number]["role"],
      state: expectString(invitation.state, "invitation.state") as OwnerSettingsSnapshotDTO["invitations"][number]["state"],
      createdAt: expectString(invitation.createdAt, "invitation.createdAt"),
      expiresAt: maybeString(invitation.expiresAt),
    })),
  };
}

async function rpcResult<T>(
  client: SupabaseRpcClient,
  fn: string,
  input: RpcRow,
  fallbackCode: string,
  mapper: (value: unknown) => T,
): Promise<Result<T>> {
  const { data, error } = await client.rpc<RpcRow>(fn, { p_input: input });
  if (error) return fail(error.code ?? fallbackCode, error.message);
  if (!data) return fail(`${fallbackCode}_EMPTY`, `${fn} returned no payload.`);
  if (data.ok === false) return fail(String(data.code ?? fallbackCode), `${fn} rejected the command.`);
  try {
    return { ok: true, value: mapper(data.snapshot) };
  } catch (err) {
    return fail(`${fallbackCode}_MALFORMED`, err instanceof Error ? err.message : `${fn} returned malformed payload.`);
  }
}

export function createPostgresReportingPlatformFacadeMethods(
  client: SupabaseRpcClient,
): Pick<ServiceDeskFacade, "readReportingSnapshot" | "readPlatformBillingSnapshot" | "readOwnerSettingsSnapshot"> {
  return {
    readReportingSnapshot(ctx: ActorContext, query: ReportingSnapshotQuery): Promise<Result<ReportingSnapshotDTO>> {
      return rpcResult(client, "servicedesk_read_reporting_snapshot", {
        workspaceId: ctx.workspaceId,
        actorUserId: ctx.userId,
        actorRole: ctx.role,
        ...query,
      }, "REPORTING_RPC_ERROR", mapReporting);
    },

    readPlatformBillingSnapshot(ctx: ActorContext): Promise<Result<PlatformBillingSnapshotDTO>> {
      return rpcResult(client, "servicedesk_read_platform_billing_snapshot", {
        workspaceId: ctx.workspaceId,
        actorUserId: ctx.userId,
        actorRole: ctx.role,
      }, "PLATFORM_BILLING_RPC_ERROR", mapPlatformBilling);
    },

    readOwnerSettingsSnapshot(ctx: ActorContext): Promise<Result<OwnerSettingsSnapshotDTO>> {
      return rpcResult(client, "servicedesk_read_owner_settings_snapshot", {
        workspaceId: ctx.workspaceId,
        actorUserId: ctx.userId,
        actorRole: ctx.role,
      }, "OWNER_SETTINGS_RPC_ERROR", mapOwnerSettings);
    },
  };
}
