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
  const requested = Math.floor(value ?? 60);
  return Math.max(30, Math.min(requested, 300));
}

function nextExpiry(now: string, seconds: number): string {
  return new Date(new Date(now).getTime() + seconds * 1000).toISOString();
}

export function planProviderRecoveryLease(input: ProviderRecoveryLeaseInput): ProviderRecoveryLeaseDecision {
  const durationSeconds = clampLeaseDurationSeconds(input.leaseDurationSeconds);
  const existingExpiry = input.leaseExpiresAt ? new Date(input.leaseExpiresAt).getTime() : undefined;
  const now = new Date(input.now).getTime();
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
