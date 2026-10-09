export type VerticalPackEvidenceStatus =
  | "BASELINE_EXISTING"
  | "BUYER_EVIDENCE_BLOCKED"
  | "BUYER_EVIDENCE_VERIFIED";

export interface VerticalPackVersionDTO {
  id: string;
  packCode: string;
  versionNumber: number;
  state: "DRAFT" | "RELEASED" | "RETIRED";
  evidenceStatus: VerticalPackEvidenceStatus;
  durationAdapterKey: string;
  pricingAdapterKey: string;
  releaseNotes?: string;
}

export interface WorkspaceVerticalPackDTO {
  workspaceId: string;
  packCode: string;
  versionNumber: number;
  status: "ENABLED" | "DISABLED";
  enabledAt?: string;
  disabledAt?: string;
  version: number;
}

export interface ServiceVerticalBindingDTO {
  workspaceId: string;
  serviceId: string;
  packCode: string;
  versionNumber: number;
}
