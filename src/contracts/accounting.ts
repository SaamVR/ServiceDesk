import type { ISODateTime } from "./core";

export type AccountingIntegrationStatus = "DISCONNECTED" | "READY" | "AUTH_EXPIRED" | "ERROR";
export type AccountingSyncOwner = "SERVICEDESK" | "EXTERNAL";
export type AccountingEntityType = "CONTACT" | "INVOICE" | "PAYMENT" | "CREDIT";
export type AccountingLocalResourceKind =
  | "COMMERCIAL_ORGANIZATION"
  | "INVOICE"
  | "VERIFIED_PAYMENT"
  | "MANUAL_PAYMENT"
  | "COMMERCIAL_BILLING_LINE";
export type AccountingReconciliationState = "PENDING" | "SYNCED" | "CONFLICT" | "ERROR";

export interface AccountingIntegrationDTO {
  id: string;
  workspaceId: string;
  provider: string;
  status: AccountingIntegrationStatus;
  defaultSyncOwner: AccountingSyncOwner;
  lastSuccessAt?: ISODateTime;
  lastErrorCode?: string;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AccountingReconciliationRecordDTO {
  id: string;
  workspaceId: string;
  integrationId: string;
  entityType: AccountingEntityType;
  localResourceKind: AccountingLocalResourceKind;
  localResourceId: string;
  localVersion: number;
  externalId?: string;
  externalVersion?: string;
  syncOwner: AccountingSyncOwner;
  state: AccountingReconciliationState;
  lastErrorCode?: string;
  idempotencyKey: string;
  payloadFingerprint: string;
  syncedAt?: ISODateTime;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AccountingReconciliationSnapshotDTO {
  workspaceId: string;
  integrations: AccountingIntegrationDTO[];
  records: AccountingReconciliationRecordDTO[];
  pendingCount: number;
  conflictCount: number;
  errorCount: number;
}
