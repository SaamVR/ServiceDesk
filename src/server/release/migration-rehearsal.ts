import { createHash } from "node:crypto";

export type MigrationRehearsalResult = "PASS" | "FAIL";

export interface V2MigrationRehearsalPlan {
  buildSha: string;
  migrationFiles: string[];
  migrationHead: string;
  planFingerprint: string;
  targetClass: "DISPOSABLE_NON_PRODUCTION";
  dataClass: "SYNTHETIC_ONLY";
  rollbackMode: "DATABASE_RESTORE_OR_DISPOSABLE_RESET";
}

export interface V2MigrationRehearsalReceipt {
  schema: "servicedesk-v2-migration-rehearsal-v1";
  buildSha: string;
  migrationHead: string;
  planFingerprint: string;
  targetClass: "DISPOSABLE_NON_PRODUCTION";
  dataClass: "SYNTHETIC_ONLY";
  rollbackMode: "DATABASE_RESTORE_OR_DISPOSABLE_RESET";
  upgradeResult: MigrationRehearsalResult;
  rollbackResult: MigrationRehearsalResult;
  cleanupResult: MigrationRehearsalResult;
  capturedAt: string;
  redactedReference: string;
}

export interface MigrationRehearsalValidation {
  accepted: boolean;
  code:
    | "REHEARSAL_ACCEPTED"
    | "REHEARSAL_BUILD_MISMATCH"
    | "REHEARSAL_HEAD_MISMATCH"
    | "REHEARSAL_FINGERPRINT_MISMATCH"
    | "REHEARSAL_TARGET_INVALID"
    | "REHEARSAL_DATA_CLASS_INVALID"
    | "REHEARSAL_ROLLBACK_MODE_INVALID"
    | "REHEARSAL_RESULT_NOT_PASS"
    | "REHEARSAL_TIMESTAMP_INVALID"
    | "REHEARSAL_REFERENCE_INVALID";
}

const migrationFilePattern = /^\d{4}[a-z]?_[a-z0-9][a-z0-9_-]*\.sql$/i;
const shaPattern = /^[a-f0-9]{7,40}$/i;
const fingerprintPattern = /^[a-f0-9]{64}$/i;
const redactedReferencePattern = /^rehearsal:redacted:[A-Za-z0-9._:-]{3,160}$/;

export function buildMigrationRehearsalPlan(input: {
  buildSha: string;
  migrationFiles: string[];
}): V2MigrationRehearsalPlan {
  if (!shaPattern.test(input.buildSha)) {
    throw new Error("Migration rehearsal requires a Git build SHA.");
  }
  const files = [...input.migrationFiles].sort((left, right) => left.localeCompare(right));
  if (files.length === 0 || files.some((file) => !migrationFilePattern.test(file))) {
    throw new Error("Migration rehearsal inventory is empty or malformed.");
  }
  if (new Set(files).size !== files.length) {
    throw new Error("Migration rehearsal inventory contains duplicate filenames.");
  }
  const migrationHead = files.at(-1)!;
  const planFingerprint = createHash("sha256")
    .update(JSON.stringify({ buildSha: input.buildSha, migrationFiles: files }))
    .digest("hex");

  return {
    buildSha: input.buildSha,
    migrationFiles: files,
    migrationHead,
    planFingerprint,
    targetClass: "DISPOSABLE_NON_PRODUCTION",
    dataClass: "SYNTHETIC_ONLY",
    rollbackMode: "DATABASE_RESTORE_OR_DISPOSABLE_RESET",
  };
}

export function validateMigrationRehearsalReceipt(input: {
  plan: V2MigrationRehearsalPlan;
  receipt: V2MigrationRehearsalReceipt;
}): MigrationRehearsalValidation {
  const { plan, receipt } = input;
  if (receipt.buildSha !== plan.buildSha) return { accepted: false, code: "REHEARSAL_BUILD_MISMATCH" };
  if (receipt.migrationHead !== plan.migrationHead) return { accepted: false, code: "REHEARSAL_HEAD_MISMATCH" };
  if (!fingerprintPattern.test(receipt.planFingerprint) || receipt.planFingerprint !== plan.planFingerprint) {
    return { accepted: false, code: "REHEARSAL_FINGERPRINT_MISMATCH" };
  }
  if (receipt.targetClass !== "DISPOSABLE_NON_PRODUCTION") {
    return { accepted: false, code: "REHEARSAL_TARGET_INVALID" };
  }
  if (receipt.dataClass !== "SYNTHETIC_ONLY") {
    return { accepted: false, code: "REHEARSAL_DATA_CLASS_INVALID" };
  }
  if (receipt.rollbackMode !== "DATABASE_RESTORE_OR_DISPOSABLE_RESET") {
    return { accepted: false, code: "REHEARSAL_ROLLBACK_MODE_INVALID" };
  }
  if (receipt.upgradeResult !== "PASS" || receipt.rollbackResult !== "PASS" || receipt.cleanupResult !== "PASS") {
    return { accepted: false, code: "REHEARSAL_RESULT_NOT_PASS" };
  }
  if (!Number.isFinite(Date.parse(receipt.capturedAt))) {
    return { accepted: false, code: "REHEARSAL_TIMESTAMP_INVALID" };
  }
  if (!redactedReferencePattern.test(receipt.redactedReference)) {
    return { accepted: false, code: "REHEARSAL_REFERENCE_INVALID" };
  }
  return { accepted: true, code: "REHEARSAL_ACCEPTED" };
}
