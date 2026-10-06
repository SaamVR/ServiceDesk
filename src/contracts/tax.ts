import type { ISODateTime } from "./core";

export type TaxProfileStatus = "DRAFT" | "REVIEWED" | "RETIRED";
export type TaxProfileProvenanceKind = "ACCOUNTANT_GUIDANCE" | "TAX_AUTHORITY" | "ACCOUNTING_SYSTEM" | "OTHER";

export interface WorkspaceTaxProfileDTO {
  id: string;
  workspaceId: string;
  jurisdictionCode: string;
  taxCode: string;
  rateBasisPoints: number;
  priceIncludesTax: boolean;
  status: TaxProfileStatus;
  provenanceKind: TaxProfileProvenanceKind;
  provenanceReference: string;
  effectiveFrom: string;
  effectiveTo?: string;
  reviewedByUserId?: string;
  reviewedAt?: ISODateTime;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface WorkspaceTaxProfileSnapshotDTO {
  workspaceId: string;
  automaticApplicationEnabled: false;
  profiles: WorkspaceTaxProfileDTO[];
}
