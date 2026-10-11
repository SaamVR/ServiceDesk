import type { Result } from "../../../contracts";
import type { ProviderRecoveryQueueRecord } from "./queue";

export interface SerializedProviderRecoveryRecord {
  schemaVersion: 1;
  record: ProviderRecoveryQueueRecord;
}

const expectedActionByQueue: Record<ProviderRecoveryQueueRecord["queue"], ProviderRecoveryQueueRecord["action"]> = {
  "provider-retry": "RETRY",
  "provider-reconciliation": "RECONCILE",
  "provider-operator-review": "OPERATOR_REVIEW",
  "provider-dead-letter": "DEAD_LETTER",
  "provider-configuration-blocked": "BLOCKED_CONFIGURATION",
};
const providerNames = new Set(["WHATSAPP", "GOOGLE_CALENDAR", "PAYMENT", "EMAIL", "WEBHOOK", "AI"]);
const operationNames = new Set(["OUTBOUND_SEND", "INBOUND_PARSE", "STATUS_CALLBACK", "SYNC", "CALLBACK_APPLY", "DELIVERY"]);

const SECRET_PATTERNS = [
  /access[_-]?token\s*=\s*[^\s,;]+/gi,
  /refresh[_-]?token\s*=\s*[^\s,;]+/gi,
  /secret\s*=\s*[^\s,;]+/gi,
  /authorization\s*[:=]\s*bearer\s+[^\s,;]+/gi,
  /raw body\s*:.*/gi,
  /\bBearer\s+[A-Za-z0-9._~+\/-]+/gi,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi,
  /\+?\d{8,15}/g,
];

function redactNote(note: string): string {
  return SECRET_PATTERNS.reduce((value, pattern) => value.replace(pattern, "[redacted]"), note);
}

function sanitizeRecord(record: ProviderRecoveryQueueRecord): ProviderRecoveryQueueRecord {
  return {
    ...record,
    // Provider callbacks sometimes mislabel raw recipient addresses as a
    // "redacted" target. Strip obvious PII before persisting diagnostics.
    redactedTarget: record.redactedTarget ? redactNote(record.redactedTarget) : undefined,
    mutatesBusinessTruth: false,
    notes: record.notes.map(redactNote),
  };
}

export function serializeRecoveryRecord(record: ProviderRecoveryQueueRecord): SerializedProviderRecoveryRecord {
  return {
    schemaVersion: 1,
    record: sanitizeRecord(record),
  };
}

export function deserializeRecoveryRecord(input: SerializedProviderRecoveryRecord): Result<ProviderRecoveryQueueRecord> {
  // Persisted or inbound records are untrusted at runtime regardless of their
  // static TS type. Validate before touching notes or replaying provider work.
  if (!input || typeof input !== "object" || input.schemaVersion !== 1) {
    return { ok: false, code: "RECOVERY_RECORD_SCHEMA_UNSUPPORTED", message: "Provider recovery record schema version is unsupported." };
  }

  const record = input.record;
  if (!record || typeof record !== "object") {
    return { ok: false, code: "RECOVERY_RECORD_INCOMPLETE", message: "Recovery record payload is missing." };
  }
  if (record.mutatesBusinessTruth !== false) {
    return { ok: false, code: "RECOVERY_RECORD_UNSAFE_MUTATION", message: "Provider recovery records may not mutate authoritative business truth." };
  }

  const queues = new Set(["provider-retry", "provider-reconciliation", "provider-operator-review",
    "provider-dead-letter", "provider-configuration-blocked"]);
  if (typeof record.workspaceId !== "string" || !record.workspaceId.trim() ||
      typeof record.idempotencyKey !== "string" || !record.idempotencyKey.trim() ||
      !queues.has(record.queue) || !providerNames.has(record.provider) ||
      !operationNames.has(record.operation) ||
      record.action !== expectedActionByQueue[record.queue] ||
      record.operatorVisible !== !["provider-retry", "provider-reconciliation"].includes(record.queue) ||
      (record.redactedTarget !== undefined && typeof record.redactedTarget !== "string") ||
      (record.leasedBy !== undefined && typeof record.leasedBy !== "string") ||
      !Array.isArray(record.notes) || record.notes.some(note => typeof note !== "string") ||
      !Number.isSafeInteger(record.attempts) || record.attempts < 0 ||
      !Number.isSafeInteger(record.maxAttempts) || record.maxAttempts < 1) {
    return { ok: false, code: "RECOVERY_RECORD_INCOMPLETE", message: "Provider recovery record has invalid restart-safe identity or state fields." };
  }

  if (!Number.isFinite(Date.parse(record.queuedAt)) ||
      !Number.isFinite(Date.parse(record.occurredAt)) ||
      (record.nextAttemptAt !== undefined &&
        (typeof record.nextAttemptAt !== "string" || !Number.isFinite(Date.parse(record.nextAttemptAt)))) ||
      (record.leaseExpiresAt !== undefined &&
        (typeof record.leaseExpiresAt !== "string" || !Number.isFinite(Date.parse(record.leaseExpiresAt))))) {
    return { ok: false, code: "RECOVERY_RECORD_SCHEDULE_INVALID", message: "Recovery record has an invalid scheduling timestamp." };
  }

  return { ok: true, value: sanitizeRecord(record) };
}
