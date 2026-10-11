export type ProviderRecoveryLeaseAction = "CLAIM" | "RENEW" | "HELD";

export interface ProviderRecoveryLeaseInput {
  workspaceId: string;
  idempotencyKey: string;
  workerId: string;
  now: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  leaseDurationSeconds?: number;
}

export interface ProviderRecoveryLeaseDecision {
  action: ProviderRecoveryLeaseAction;
  workspaceId: string;
  idempotencyKey: string;
  holder: string;
  canExecute: boolean;
  leaseExpiresAt: string;
  mutatesBusinessTruth: false;
  notes: string[];
}

function clampLeaseDurationSeconds(value: number | undefined): number {
  const requested = value === undefined || !Number.isFinite(value) ? 60 : Math.floor(value);
  return Math.max(30, Math.min(requested, 300));
}

function nextExpiry(now: string, seconds: number): string {
  return new Date(new Date(now).getTime() + seconds * 1000).toISOString();
}

export function planProviderRecoveryLease(input: ProviderRecoveryLeaseInput): ProviderRecoveryLeaseDecision {
  const durationSeconds = clampLeaseDurationSeconds(input.leaseDurationSeconds);
  const existingExpiry = input.leaseExpiresAt ? new Date(input.leaseExpiresAt).getTime() : undefined;
  const now = new Date(input.now).getTime();
  const clockValid = Number.isFinite(now) && Math.abs(now) <= 8.64e15 - durationSeconds * 1_000;
  const identityValid = Boolean(input.workspaceId?.trim() && input.idempotencyKey?.trim() && input.workerId?.trim());
  const ambiguousExistingLease = Boolean(input.leaseOwner && !Number.isFinite(existingExpiry));
  if (!clockValid || !identityValid || ambiguousExistingLease) {
    return {
      action: "HELD",
      workspaceId: input.workspaceId,
      idempotencyKey: input.idempotencyKey,
      holder: input.leaseOwner || "UNASSIGNED",
      canExecute: false,
      leaseExpiresAt: input.leaseExpiresAt || (clockValid ? new Date(now).toISOString() : "1970-01-01T00:00:00.000Z"),
      mutatesBusinessTruth: false,
      notes: ["Invalid lease clock, worker identity or existing lease expiry; require operator reconciliation before replay."],
    };
  }

  const activeLease = Boolean(input.leaseOwner && existingExpiry !== undefined && existingExpiry > now);

  if (activeLease && input.leaseOwner !== input.workerId) {
    return {
      action: "HELD",
      workspaceId: input.workspaceId,
      idempotencyKey: input.idempotencyKey,
      holder: input.leaseOwner!,
      canExecute: false,
      leaseExpiresAt: input.leaseExpiresAt!,
      mutatesBusinessTruth: false,
      notes: ["Active provider recovery lease is held by another worker; duplicate replay is suppressed."],
    };
  }

  const action: ProviderRecoveryLeaseAction =
    activeLease && input.leaseOwner === input.workerId ? "RENEW" : "CLAIM";

  return {
    action,
    workspaceId: input.workspaceId,
    idempotencyKey: input.idempotencyKey,
    holder: input.workerId,
    canExecute: true,
    leaseExpiresAt: nextExpiry(input.now, durationSeconds),
    mutatesBusinessTruth: false,
    notes: [
      action === "RENEW"
        ? "Recovery worker renewed its existing lease."
        : "Recovery item is available for a bounded worker lease.",
      "Lease decisions coordinate provider replay only and do not mutate business truth.",
    ],
  };
}
