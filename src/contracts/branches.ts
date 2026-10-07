export interface WorkspaceBranchDTO {
  id: string;
  workspaceId: string;
  code: string;
  name: string;
  timezone: string;
  currency: string;
  active: boolean;
  isDefault: boolean;
  version: number;
}

export interface BranchAssignmentDTO {
  branchId: string;
  userId: string;
  role: "OWNER" | "DISPATCHER" | "CREW";
  active: boolean;
  version: number;
}

export interface BranchAccessSnapshotDTO {
  workspaceId: string;
  ownerGlobalAccess: boolean;
  branches: WorkspaceBranchDTO[];
  assignments: BranchAssignmentDTO[];
}

export interface BranchReportingRowDTO {
  branchId: string;
  code: string;
  name: string;
  timezone: string;
  currency: string;
  active: boolean;
  from?: string;
  to?: string;
  localFrom?: string;
  localTo?: string;
  requestCount: number;
  bookedRequestCount: number;
  conversionRateBps?: number;
  collectedMinor: number;
  outstandingMinor: number;
  scheduledServiceMinutes: number;
  scheduledBufferMinutes: number;
  unresolvedQualityCount: number;
  generatedAt?: string;
}

export interface BranchComparisonSnapshotDTO {
  workspaceId: string;
  from?: string;
  to?: string;
  branches: BranchReportingRowDTO[];
  mixedCurrency: boolean;
  aggregateCurrency?: string;
  aggregateCollectedMinor?: number;
  aggregateOutstandingMinor?: number;
  currencyDisclosure: string;
  generatedAt: string;
}
