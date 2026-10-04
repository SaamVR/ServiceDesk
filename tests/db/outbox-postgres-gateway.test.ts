import { describe, expect, it } from "vitest";
import { createPostgresOutboxTableGateway, type TrustedOutboxRpcClient } from "../../src/server/jobs/outbox-postgres-gateway";

const row = {
  id: "00000000-0000-0000-0000-000000000001",
  workspace_id: "00000000-0000-0000-0000-000000000002",
  topic: "payment.received",
  payload: { invoiceId: "inv_1" },
  status: "PENDING" as const,
  attempts: 2,
  idempotency_key: "idem_1",
  next_attempt_at: null,
  locked_at: "2026-10-04T14:00:00.000Z",
  locked_by: "worker-a",
  sent_at: null,
  provider_reference: null,
  last_error_code: null,
  created_at: "2026-10-04T13:59:00.000Z",
  updated_at: "2026-10-04T14:00:00.000Z",
};

describe("trusted Postgres outbox gateway", () => {
  it("claims through the trusted RPC and maps snake_case rows", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client: TrustedOutboxRpcClient = {
      async rpc(name, args) {
        calls.push({ name, args });
        return { data: [row] as never, error: null };
      },
    };
    const gateway = createPostgresOutboxTableGateway(client);
    await expect(gateway.claimReady("worker-a", "2026-10-04T14:00:00.000Z", 60, 10)).resolves.toMatchObject({
      data: [{ id: row.id, workspaceId: row.workspace_id, attempts: 2, lockedBy: "worker-a" }],
      error: null,
    });
    expect(calls[0]).toMatchObject({ name: "claim_ready_outbox_events", args: { p_worker_id: "worker-a", p_lease_seconds: 60, p_limit: 10 } });
  });

  it("completes through the lease-owner RPC and preserves attempts on SENT", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client: TrustedOutboxRpcClient = {
      async rpc(name, args) {
        calls.push({ name, args });
        return { data: { ...row, status: "SENT", locked_at: null, locked_by: null } as never, error: null };
      },
    };
    const gateway = createPostgresOutboxTableGateway(client);
    await gateway.markSent(row.id, "worker-a", "2026-10-04T14:01:00.000Z", "wamid.1");
    expect(calls[0]).toMatchObject({
      name: "complete_outbox_event",
      args: { p_worker_id: "worker-a", p_status: "SENT", p_attempts: null, p_provider_reference: "wamid.1" },
    });
  });
});
