import type { Result } from "../../../contracts";
import type { ProviderRecoveryQueueRecord } from "./queue";

export interface SerializedProviderRecoveryRecord {
  schemaVersion: 1;
  record: ProviderRecoveryQueueRecord;
}

const SECRET_PATTERNS = [
  /access[_-]?token\s*=\s*[^\s,;]+/gi,
  /refresh[_-]?token\s*=\s*[^\s,;]+/gi,
  /secret\s*=\s*[^\s,;]+/gi,
  /authorization\s*[:=]\s*bearer\s+[^\s,;]+/gi,
  /raw body\s*:.*/gi,
];

function redactNote(note: string): string {
  return SECRET_PATTERNS.reduce((value, pattern) => value.replace(pattern, "[redacted]"), note);
}

function sanitizeRecord(record: ProviderRecoveryQueueRecord): ProviderRecoveryQueueRecord {
  return {
    ...record,
    redactedTarget: record.redactedTarget,
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
  if (input.schemaVersion !== 1) {
    return { ok: false, code: "RECOVERY_RECORD_SCHEMA_UNSUPPORTED", message: "Provider recovery record schema version is unsupported." };
  }

  if (input.record.mutatesBusinessTruth !== false) {
    return { ok: false, code: "RECOVERY_RECORD_UNSAFE_MUTATION", message: "Provider recovery records may not mutate authoritative business truth." };
  }

  if (!input.record.idempotencyKey || !input.record.queue || !input.record.provider || !input.record.operation) {
    return { ok: false, code: "RECOVERY_RECORD_INCOMPLETE", message: "Provider recovery record is missing restart-safe identity fields." };
  }

  return { ok: true, value: sanitizeRecord(input.record) };
}
