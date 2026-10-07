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
