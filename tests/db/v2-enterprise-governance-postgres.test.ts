import { describe, expect, it, vi } from "vitest";
import { createPostgresEnterpriseGovernancePort } from "../../src/server/core/enterprise-governance-postgres";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const owner = { workspaceId: "workspace-1", userId: "owner-1", role: "OWNER" as const };
const dispatcher = { workspaceId: "workspace-1", userId: "dispatcher-1", role: "DISPATCHER" as const };

describe("enterprise governance Postgres boundary", () => {
  it("keeps capability delegation owner-only before RPC execution", async () => {
    const rpc = vi.fn();
    const port = createPostgresEnterpriseGovernancePort({ rpc } as SupabaseRpcClient);
    await expect(port.setCapability(dispatcher, {
      userId: "dispatcher-2",
      capability: "SERVICE_CATALOG_MANAGE",
      status: "ACTIVE",
    })).resolves.toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes fixed capability updates through the authoritative RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        userId: "dispatcher-2",
        capability: "SERVICE_CATALOG_MANAGE",
        status: "ACTIVE",
        version: 2,
      },
      error: null,
    });
    const port = createPostgresEnterpriseGovernancePort({ rpc } as SupabaseRpcClient);
    await expect(port.setCapability(owner, {
      userId: "dispatcher-2",
      capability: "SERVICE_CATALOG_MANAGE",
      status: "ACTIVE",
    })).resolves.toMatchObject({
      ok: true,
      value: { userId: "dispatcher-2", capability: "SERVICE_CATALOG_MANAGE", status: "ACTIVE", version: 2 },
    });
  });

  it("keeps support access owner-only and returns only grant metadata", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        grantId: "grant-1",
        scope: "READ_DIAGNOSTICS",
        expiresAt: "2026-10-10T12:00:00.000Z",
      },
      error: null,
    });
    const port = createPostgresEnterpriseGovernancePort({ rpc } as SupabaseRpcClient);
    await expect(port.grantSupportAccess(owner, {
      supportSubjectHash: "a".repeat(64),
      scope: "READ_DIAGNOSTICS",
      reason: "Investigate webhook delivery",
      expiresAt: "2026-10-10T12:00:00.000Z",
    })).resolves.toMatchObject({
      ok: true,
      value: { grantId: "grant-1", scope: "READ_DIAGNOSTICS" },
    });
    const payload = rpc.mock.calls[0]?.[1]?.p_input;
    expect(payload).not.toHaveProperty("supportEmail");
    expect(payload).not.toHaveProperty("supportToken");
  });

  it("maps bounded metadata-only audit export", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        from: "2026-10-01T00:00:00.000Z",
        to: "2026-10-10T00:00:00.000Z",
        truncated: false,
        redaction: "Metadata only. before_data and after_data are intentionally excluded.",
        rows: [{
          id: "audit-1",
          actorRole: "OWNER",
          action: "WORKFLOW_RULE_VERSION_PUBLISHED",
          resourceType: "workflow_rule",
          resourceId: "rule-1",
          requestId: null,
          createdAt: "2026-10-09T20:00:00.000Z",
        }],
      },
      error: null,
    });
    const port = createPostgresEnterpriseGovernancePort({ rpc } as SupabaseRpcClient);
    const result = await port.readAuditMetadata(owner, {
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-10-10T00:00:00.000Z",
      limit: 1000,
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        truncated: false,
        rows: [{ action: "WORKFLOW_RULE_VERSION_PUBLISHED", resourceType: "workflow_rule" }],
      },
    });
    expect(result.ok && result.value.rows[0]).not.toHaveProperty("beforeData");
    expect(result.ok && result.value.rows[0]).not.toHaveProperty("afterData");
    expect(result.ok && result.value.redaction).toContain("before_data and after_data are intentionally excluded");
  });

  it("rejects audit export for delegated dispatchers", async () => {
    const rpc = vi.fn();
    const port = createPostgresEnterpriseGovernancePort({ rpc } as SupabaseRpcClient);
    await expect(port.readAuditMetadata(dispatcher, {
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-10-10T00:00:00.000Z",
    })).resolves.toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
