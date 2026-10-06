import type { CurrencyCode, ISODateTime } from "./core";

export type CommercialFeatureKey = "COMMERCIAL_OPERATIONS";
export type CommercialOrganizationStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";
export type CommercialContractStatus = "DRAFT" | "ACTIVE" | "SUSPENDED" | "ENDED";
export type CommercialContractVersionState = "DRAFT" | "APPROVED" | "SUPERSEDED";
export type CommercialServicePlanStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED";
export type CommercialServicePlanFrequency = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
export type CommercialExceptionType = "DENIED_ACCESS" | "MISSED_VISIT" | "EXTRA_WORK";
export type CommercialExceptionState = "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
export type CommercialAdjustmentKind = "CREDIT" | "CHARGE";

export interface WorkspaceFeatureFlagDTO {
  workspaceId: string;
  featureKey: CommercialFeatureKey | string;
  enabled: boolean;
  config: Record<string, unknown>;
  version: number;
  updatedAt: ISODateTime;
}

export interface CommercialOrganizationDTO {
  id: string;
  workspaceId: string;
  displayName: string;
  legalName?: string;
  reference?: string;
  status: CommercialOrganizationStatus;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CommercialPortfolioContactDTO {
  id: string;
  workspaceId: string;
  organizationId: string;
  customerId: string;
  title?: string;
  authorizedRequester: boolean;
  billingContact: boolean;
  operationsContact: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** A commercial site preserves the authoritative V1 property identifier. */
export interface CommercialSiteDTO {
  id: string;
  workspaceId: string;
  organizationId: string;
  propertyId: string;
  siteCode?: string;
  active: boolean;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CommercialContractDTO {
  id: string;
  workspaceId: string;
  organizationId: string;
  contractNumber: string;
  status: CommercialContractStatus;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CommercialContractVersionDTO {
  id: string;
  workspaceId: string;
  contractId: string;
  versionNumber: number;
  state: CommercialContractVersionState;
  effectiveFrom: string;
  effectiveTo?: string;
  currency: CurrencyCode;
  rateSnapshot: Record<string, unknown>;
  approvalAuthority: Record<string, unknown>;
  approvedByUserId?: string;
  approvedAt?: ISODateTime;
  createdAt: ISODateTime;
}

export interface CommercialContractSiteDTO {
  id: string;
  workspaceId: string;
  contractVersionId: string;
  siteId: string;
  serviceId: string;
  scopeSnapshot: Record<string, unknown>;
  serviceLevelTargetMinutes?: number;
  availabilitySnapshot: Record<string, unknown>;
  rateOverrideSnapshot?: Record<string, unknown>;
  active: boolean;
  createdAt: ISODateTime;
}

export interface CommercialSiteServicePlanDTO {
  id: string;
  workspaceId: string;
  contractVersionId: string;
  contractSiteId: string;
  recurrenceRuleId?: string;
  frequency: CommercialServicePlanFrequency;
  timezone: string;
  localStartTime: string;
  startsOn: string;
  endsOn?: string;
  preferredWindowStart?: string;
  preferredWindowEnd?: string;
  status: CommercialServicePlanStatus;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CommercialExceptionCaseDTO {
  id: string;
  workspaceId: string;
  organizationId: string;
  contractId: string;
  contractVersionId?: string;
  siteId: string;
  visitId?: string;
  type: CommercialExceptionType;
  state: CommercialExceptionState;
  summary: string;
  ownerUserId?: string;
  requestedAdjustmentKind?: CommercialAdjustmentKind;
  requestedAdjustmentMinor?: number;
  requestedAdjustmentCurrency?: CurrencyCode;
  resolutionNote?: string;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export interface CommercialPortfolioSnapshotDTO {
  workspaceId: string;
  feature: WorkspaceFeatureFlagDTO;
  organizations: CommercialOrganizationDTO[];
  contacts: CommercialPortfolioContactDTO[];
  sites: CommercialSiteDTO[];
  contracts: CommercialContractDTO[];
  contractVersions: CommercialContractVersionDTO[];
  contractSites: CommercialContractSiteDTO[];
  servicePlans: CommercialSiteServicePlanDTO[];
  exceptionCases: CommercialExceptionCaseDTO[];
}

export type CommercialBillingDraftState = "DRAFT" | "FINALIZED" | "VOID";
export type CommercialBillingLineState = "INCLUDED" | "EXCLUDED";
export type CommercialBillingLineSource = "VISIT" | "ADJUSTMENT";
export type CommercialBillingDirection = "CHARGE" | "CREDIT";

export interface CommercialBillingLineDTO {
  id: string;
  workspaceId: string;
  draftId: string;
  sourceType: CommercialBillingLineSource;
  visitId?: string;
  exceptionCaseId?: string;
  direction: CommercialBillingDirection;
  amountMinor: number;
  currency: CurrencyCode;
  state: CommercialBillingLineState;
  descriptionSnapshot: Record<string, unknown>;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CommercialBillingDraftDTO {
  id: string;
  workspaceId: string;
  organizationId: string;
  contractId: string;
  contractVersionId: string;
  periodStart: string;
  periodEnd: string;
  state: CommercialBillingDraftState;
  currency: CurrencyCode;
  chargeMinor: number;
  creditMinor: number;
  netTotalMinor: number;
  invoiceId?: string;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  lines: CommercialBillingLineDTO[];
}

export type CommercialDirectCostCategory = "LABOR" | "SUPPLIES" | "TRAVEL";
export type CommercialDirectCostBasis = "ESTIMATED" | "ACTUAL";
export type CommercialDirectCostDirection = "COST" | "REVERSAL";
export type CommercialDirectCostSourceKind = "MANUAL" | "CREW_RATE" | "SUPPLY" | "TRAVEL";

export interface CommercialDirectCostDTO {
  id: string;
  workspaceId: string;
  visitId: string;
  contractVersionId: string;
  siteId: string;
  serviceId: string;
  category: CommercialDirectCostCategory;
  basis: CommercialDirectCostBasis;
  direction: CommercialDirectCostDirection;
  amountMinor: number;
  currency: CurrencyCode;
  sourceKind: CommercialDirectCostSourceKind;
  sourceReference?: string;
  reversesEntryId?: string;
  occurredAt: ISODateTime;
  createdAt: ISODateTime;
}

export interface CommercialDirectCostTotalDTO {
  currency: CurrencyCode;
  category: CommercialDirectCostCategory;
  basis: CommercialDirectCostBasis;
  netMinor: number;
}

export interface CommercialDirectCostSnapshotDTO {
  workspaceId: string;
  entries: CommercialDirectCostDTO[];
  totals: CommercialDirectCostTotalDTO[];
}
