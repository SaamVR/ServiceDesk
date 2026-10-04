import { describe, expect, test } from "vitest";
import type { ProviderRecoveryQueueRecord } from "../../src/server/integrations/recovery/queue";
import { serializeRecoveryRecord, deserializeRecoveryRecord } from "../../src/server/integrations/recovery/serialization";

const record: ProviderRecoveryQueueRecord = {
  queue: "provider-retry",
  workspaceId: "ws-clearnest",
  provider: "WHATSAPP",
  operation: "OUTBOUND_SEND",
  action: "RETRY",
  idempotencyKey: "whatsapp:wamid-123",
  attempts: 1,
  maxAttempts: 3,
  queuedAt: "2026-10-04T06:50:00.000Z",
  occurredAt: "2026-10-04T06:45:00.000Z",
  nextAttemptAt: "2026-10-04T06:54:00.000Z",
  redactedTarget: "155…4567",
  operatorVisible: false,
  mutatesBusinessTruth: false,
  notes: ["Retry with original idempotency key", "access_token=secret", "raw body: hello customer"],
};

describe("provider recovery serialization", () => {
  test("serializes enough restart-safe data while redacting secrets and bodies", () => {
    const serialized = serializeRecoveryRecord(record);

    expect(serialized.schemaVersion).toBe(1);
    expect(serialized.record).toMatchObject({
      queue: "provider-retry",
      provider: "WHATSAPP",
      operation: "OUTBOUND_SEND",
      idempotencyKey: "whatsapp:wamid-123",
      attempts: 1,
      maxAttempts: 3,
      mutatesBusinessTruth: false,
    });
    expect(JSON.stringify(serialized)).not.toContain("access_token=secret");
    expect(JSON.stringify(serialized)).not.toContain("hello customer");
  });

  test("deserializes valid records and rejects unsafe mutation payloads", () => {
    const serialized = serializeRecoveryRecord(record);
    expect(deserializeRecoveryRecord(serialized)).toEqual({ ok: true, value: serialized.record });

    expect(deserializeRecoveryRecord({ ...serialized, record: { ...serialized.record, mutatesBusinessTruth: true } } as any)).toMatchObject({
      ok: false,
      code: "RECOVERY_RECORD_UNSAFE_MUTATION",
    });
  });
});
