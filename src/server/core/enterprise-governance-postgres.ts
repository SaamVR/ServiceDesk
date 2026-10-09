import type {
  ActorContext,
  AuditExportMetadataDTO,
  GovernanceCapability,
  Result,
  TenantSupportAccessGrantDTO,
} from "../../contracts";
import type { SupabaseRpcClient } from "./payment-application-postgres";

type Row = Record<string, unknown>;

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function text(row: Row, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export interface EnterpriseGovernancePort {
  setCapability(
    actor: ActorContext,
    input: { userId: string; capability: GovernanceCapability; status: "ACTIVE" | "REVOKED"; expiresAt?: string },
  ): Promise<Result<{ userId: string; capability: GovernanceCapability; status: "ACTIVE" | "REVOKED"; version: number }>>;

  grantSupportAccess(
    actor: ActorContext,
    input: { supportSubjectHash: string; scope: TenantSupportAccessGrantDTO["scope"]; reason: string; expiresAt: string },
  ): Promise<Result<{ grantId: string; scope: TenantSupportAccessGrantDTO["scope"]; expiresAt: string }>>;

  revokeSupportAccess(
    actor: ActorContext,
    grantId: string,
  ): Promise<Result<{ grantId: string; revokedAt: string }>>;

  readAuditMetadata(
    actor: ActorContext,
    input: { from: string; to: string; limit?: number },
  ): Promise<Result<AuditExportMetadataDTO>>;
}

export function createPostgresEnterpriseGovernancePort(
  client: SupabaseRpcClient,
  now: () => string = () => new Date().toISOString(),
): EnterpriseGovernancePort {
  return {
    async setCapability(actor, input) {
      if (!actor.userId || actor.role !== "OWNER") {
        return fail("FORBIDDEN", "Only an owner can delegate governance capabilities.");
      }
      const { data, error } = await client.rpc<Row>("servicedesk_set_operator_capability", {
        p_input: {
          workspaceId: actor.workspaceId,
          actorUserId: actor.userId,
          actorRole: actor.role,
          userId: input.userId,
          capability: input.capability,
          status: input.status,
          expiresAt: input.expiresAt,
          now: now(),
        },
      });
      if (error) return fail(error.code ?? "GOVERNANCE_CAPABILITY_RPC_ERROR", error.message);
      if (!data || data.ok !== true) {
        return fail(String(data?.code ?? "GOVERNANCE_CAPABILITY_REJECTED"), "Governance capability update was rejected.");
      }
      const userId = text(data, "userId");
      const capability = text(data, "capability");
      const status = text(data, "status");
      const version = typeof data.version === "number" ? data.version : Number.NaN;
      if (!userId
          || !["SERVICE_CATALOG_MANAGE","WORKFLOW_MANAGE","RETENTION_MANAGE"].includes(capability ?? "")
          || !["ACTIVE","REVOKED"].includes(status ?? "")
          || !Number.isInteger(version)) {
        return fail("GOVERNANCE_CAPABILITY_RPC_MALFORMED", "Governance capability response was malformed.");
      }
      return {
        ok: true,
        value: {
          userId,
          capability: capability as GovernanceCapability,
          status: status as "ACTIVE" | "REVOKED",
          version,
        },
      };
    },

    async grantSupportAccess(actor, input) {
      if (!actor.userId || actor.role !== "OWNER") {
        return fail("FORBIDDEN", "Only an owner can grant tenant support access.");
      }
      const { data, error } = await client.rpc<Row>("servicedesk_grant_tenant_support_access", {
        p_input: {
          workspaceId: actor.workspaceId,
          actorUserId: actor.userId,
          actorRole: actor.role,
          supportSubjectHash: input.supportSubjectHash,
          scope: input.scope,
          reason: input.reason,
          expiresAt: input.expiresAt,
          now: now(),
        },
      });
      if (error) return fail(error.code ?? "SUPPORT_ACCESS_RPC_ERROR", error.message);
      if (!data || data.ok !== true) {
        return fail(String(data?.code ?? "SUPPORT_ACCESS_REJECTED"), "Support access grant was rejected.");
      }
      const grantId = text(data, "grantId");
      const scope = text(data, "scope");
      const expiresAt = text(data, "expiresAt");
      if (!grantId || !expiresAt || (scope !== "READ_DIAGNOSTICS" && scope !== "READ_AUDIT_METADATA")) {
        return fail("SUPPORT_ACCESS_RPC_MALFORMED", "Support access response was malformed.");
      }
      return { ok: true, value: { grantId, scope, expiresAt } };
    },

    async revokeSupportAccess(actor, grantId) {
      if (!actor.userId || actor.role !== "OWNER") {
        return fail("FORBIDDEN", "Only an owner can revoke tenant support access.");
      }
      const { data, error } = await client.rpc<Row>("servicedesk_revoke_tenant_support_access", {
        p_input: {
          workspaceId: actor.workspaceId,
          actorUserId: actor.userId,
          actorRole: actor.role,
          grantId,
          now: now(),
        },
      });
      if (error) return fail(error.code ?? "SUPPORT_ACCESS_REVOKE_RPC_ERROR", error.message);
      if (!data || data.ok !== true) {
        return fail(String(data?.code ?? "SUPPORT_ACCESS_REVOKE_REJECTED"), "Support access revocation was rejected.");
      }
      const returnedGrantId = text(data, "grantId");
      const revokedAt = text(data, "revokedAt");
      if (!returnedGrantId || !revokedAt) {
        return fail("SUPPORT_ACCESS_REVOKE_RPC_MALFORMED", "Support access revocation response was malformed.");
      }
      return { ok: true, value: { grantId: returnedGrantId, revokedAt } };
    },

    async readAuditMetadata(actor, input) {
      if (!actor.userId || actor.role !== "OWNER") {
        return fail("FORBIDDEN", "Audit export is owner-only.");
      }
      const { data, error } = await client.rpc<Row>("servicedesk_read_audit_export_metadata", {
        p_input: {
          workspaceId: actor.workspaceId,
          actorUserId: actor.userId,
          actorRole: actor.role,
          from: input.from,
          to: input.to,
          limit: input.limit ?? 1000,
          now: now(),
        },
      });
      if (error) return fail(error.code ?? "AUDIT_EXPORT_RPC_ERROR", error.message);
      if (!data || data.ok !== true) {
        return fail(String(data?.code ?? "AUDIT_EXPORT_REJECTED"), "Audit export was rejected.");
      }
      const rows = Array.isArray(data.rows)
        ? data.rows.filter((value): value is Row => Boolean(value) && typeof value === "object" && !Array.isArray(value))
        : [];
      try {
        return {
          ok: true,
          value: {
            from: String(data.from),
            to: String(data.to),
            truncated: data.truncated === true,
            redaction: String(data.redaction ?? "Metadata only."),
            rows: rows.map((row) => ({
              id: String(row.id),
              actorRole: text(row, "actorRole"),
              action: String(row.action),
              resourceType: String(row.resourceType),
              resourceId: text(row, "resourceId"),
              requestId: text(row, "requestId"),
              createdAt: String(row.createdAt),
            })),
          },
        };
      } catch {
        return fail("AUDIT_EXPORT_RPC_MALFORMED", "Audit export response was malformed.");
      }
    },
  };
}
