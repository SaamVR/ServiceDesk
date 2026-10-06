import { describe, expect, it, vi } from "vitest";
import {
  createPostgresAccountingReconciliationReader,
  createPostgresAccountingReconciliationRecorder,
} from "../../src/server/core/accounting-reconciliation-postgres";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const ctx = { workspaceId: "workspace-1", userId: "owner-1", role: "OWNER" as const };

function integration(overrides: Record<string, unknown> = {}) {
  return {
    id: "integration-1",
    workspaceId: "workspace-1",
    provider: "example_accounting",
    status: "READY",
    defaultSyncOwner: "SERVICEDESK",
    version: 2,
    createdAt: "2026-10-06T00:00:00.000Z",
    updatedAt: "2026-10-06T01:00:00.000Z",
    ...overrides,
  };
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: "record-1",
    workspaceId: "workspace-1",
    integrationId: "integration-1",
    entityType: "INVOICE",
    localResourceKind: "INVOICE",
    localResourceId: "invoice-1",
    localVersion: 3,
    externalId: "external-invoice-1",
    externalVersion: "7",
    syncOwner: "SERVICEDESK",
    state: "SYNCED",
    idempotencyKey: "accounting:invoice:1:v3",
    payloadFingerprint: "sha256:invoice-v3",
    syncedAt: "2026-10-06T01:00:00.000Z",
    version: 1,
    createdAt: "2026-10-06T01:00:00.000Z",
    updatedAt: "2026-10-06T01:00:00.000Z",
    ...overrides,
  };
}

describe("accounting reconciliation postgres boundary", () => {
  it("maps a staff reconciliation snapshot", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        snapshot: {
          workspaceId: "workspace-1",
          integrations: [integration()],
          records: [record()],
          pendingCount: 0,
          conflictCount: 0,
          errorCount: 0,
        },
      },
      error: null,
    });
    const reader = createPostgresAccountingReconciliationReader({ rpc } as SupabaseRpcClient);
    const result = await reader.readAccountingReconciliationSnapshot(ctx);

    expect(result).toMatchObject({
      ok: true,
      value: {
        workspaceId: "workspace-1",
        integrations: [{ status: "READY" }],
        records: [{ state: "SYNCED", localResourceKind: "INVOICE" }],
      },
    });
    expect(rpc).toHaveBeenCalledWith(
      "servicedesk_read_accounting_reconciliation_snapshot",
      { p_input: expect.objectContaining({ workspaceId: "workspace-1", actorRole: "OWNER" }) },
    );
  });

  it("rejects cross-workspace reconciliation rows", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        snapshot: {
          workspaceId: "workspace-1",
          integrations: [integration()],
          records: [record({ workspaceId: "other-workspace" })],
          pendingCount: 0,
          conflictCount: 1,
          errorCount: 0,
        },
      },
      error: null,
    });
    const reader = createPostgresAccountingReconciliationReader({ rpc } as SupabaseRpcClient);
    const result = await reader.readAccountingReconciliationSnapshot(ctx);

    expect(result).toMatchObject({ ok: false, code: "ACCOUNTING_RECONCILIATION_READ_MALFORMED" });
  });

  it("blocks non-staff reads before calling the database", async () => {
    const rpc = vi.fn();
    const reader = createPostgresAccountingReconciliationReader({ rpc } as SupabaseRpcClient);
    const result = await reader.readAccountingReconciliationSnapshot({
      workspaceId: "workspace-1",
      userId: "crew-1",
      role: "CREW",
    });

    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("records provider connection state without credential fields", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, integration: integration() }, error: null });
    const recorder = createPostgresAccountingReconciliationRecorder({ rpc } as SupabaseRpcClient);
    const result = await recorder.setAccountingIntegrationState({
      workspaceId: "workspace-1",
      provider: "example_accounting",
      status: "READY",
      defaultSyncOwner: "SERVICEDESK",
      now: "2026-10-06T01:00:00.000Z",
    });

    expect(result).toMatchObject({ ok: true, value: { provider: "example_accounting", status: "READY" } });
    expect(rpc).toHaveBeenCalledWith(
      "servicedesk_set_accounting_integration_state",
      { p_input: expect.not.objectContaining({ accessToken: expect.anything(), refreshToken: expect.anything() }) },
    );
  });

  it("preserves duplicate reconciliation semantics", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, duplicate: true, record: record() },
      error: null,
    });
    const recorder = createPostgresAccountingReconciliationRecorder({ rpc } as SupabaseRpcClient);
    const result = await recorder.recordAccountingReconciliation({
      workspaceId: "workspace-1",
      provider: "example_accounting",
      entityType: "INVOICE",
      localResourceKind: "INVOICE",
      localResourceId: "invoice-1",
      localVersion: 3,
      externalId: "external-invoice-1",
      externalVersion: "7",
      syncOwner: "SERVICEDESK",
      state: "SYNCED",
      idempotencyKey: "accounting:invoice:1:v3",
      payloadFingerprint: "sha256:invoice-v3",
      now: "2026-10-06T01:00:00.000Z",
    });

    expect(result).toMatchObject({ ok: true, value: { duplicate: true, record: { state: "SYNCED" } } });
  });
});
