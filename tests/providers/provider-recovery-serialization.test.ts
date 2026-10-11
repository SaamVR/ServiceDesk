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

  test("scrubs accidental recipient PII and provider auth credentials from persisted targets and notes", () => {
    const serialized = serializeRecoveryRecord({
      ...record,
      redactedTarget: "customer@example.test +15551234567",
      notes: ["Bearer sensitiveApiKey customer@example.test", "phone=+15551234567"],
    });
    const payload = JSON.stringify(serialized);
    expect(payload).not.toContain("customer@example.test");
    expect(payload).not.toContain("+15551234567");
    expect(payload).not.toContain("sensitiveApiKey");
    expect(serialized.record.idempotencyKey).toBe("whatsapp:wamid-123");
    expect(serialized.record.redactedTarget).toContain("[redacted]");
  });

  test("rejects malformed or unsafe restart records without throwing", () => {
    const valid = serializeRecoveryRecord(record);
    const invalid = [
      null,
      { schemaVersion: 99, record: valid.record },
      { schemaVersion: 1, record: null },
      { schemaVersion: 1, record: { ...valid.record, notes: null } },
      { schemaVersion: 1, record: { ...valid.record, notes: [123] } },
      { schemaVersion: 1, record: { ...valid.record, workspaceId: "" } },
      { schemaVersion: 1, record: { ...valid.record, idempotencyKey: 123 } },
      { schemaVersion: 1, record: { ...valid.record, attempts: Number.POSITIVE_INFINITY } },
      { schemaVersion: 1, record: { ...valid.record, queue: "arbitrary-dispatch" } },
      { schemaVersion: 1, record: { ...valid.record, provider: "UNTRUSTED" } },
      { schemaVersion: 1, record: { ...valid.record, operation: "PAYMENT_UPDATE" } },
      { schemaVersion: 1, record: { ...valid.record, action: "DEAD_LETTER" } },
      { schemaVersion: 1, record: { ...valid.record, operatorVisible: true } },
      { schemaVersion: 1, record: { ...valid.record, redactedTarget: { raw: "customer@example.test" } } },
      { schemaVersion: 1, record: { ...valid.record, leasedBy: 123 } },
    ];
    for (const candidate of invalid) {
      expect(() => deserializeRecoveryRecord(candidate as any)).not.toThrow();
      expect(deserializeRecoveryRecord(candidate as any).ok).toBe(false);
    }
  });

  test("holds invalid scheduling timestamps and preserves a valid replay record", () => {
    const valid = serializeRecoveryRecord(record);
    const broken = [
      { ...valid.record, queuedAt: "not-date" },
      { ...valid.record, occurredAt: "unparseable" },
      { ...valid.record, nextAttemptAt: "invalid" },
      { ...valid.record, leaseExpiresAt: "invalid" },
    ];
    for (const payload of broken) {
      expect(deserializeRecoveryRecord({ ...valid, record: payload }))
        .toMatchObject({ ok: false, code: "RECOVERY_RECORD_SCHEDULE_INVALID" });
    }
    expect(deserializeRecoveryRecord(valid)).toEqual({ ok: true, value: valid.record });
  });

});
