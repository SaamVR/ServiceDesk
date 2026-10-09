export type GovernanceCapability =
  | "SERVICE_CATALOG_MANAGE"
  | "WORKFLOW_MANAGE"
  | "RETENTION_MANAGE";

export interface OperatorCapabilityGrantDTO {
  workspaceId: string;
  userId: string;
  capability: GovernanceCapability;
  status: "ACTIVE" | "REVOKED";
  expiresAt?: string;
  version: number;
}

export interface TenantSupportAccessGrantDTO {
  id: string;
  workspaceId: string;
  scope: "READ_DIAGNOSTICS" | "READ_AUDIT_METADATA";
  approvedAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface AuditExportMetadataRowDTO {
  id: string;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId?: string;
  createdAt: string;
}

export interface AuditExportMetadataDTO {
  from: string;
  to: string;
  truncated: boolean;
  rows: AuditExportMetadataRowDTO[];
  redaction: string;
}
