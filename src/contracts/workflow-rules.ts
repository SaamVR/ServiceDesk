export type WorkflowEventType =
  | "REQUEST_CREATED"
  | "QUOTE_ACCEPTED"
  | "VISIT_COMPLETED"
  | "INVOICE_PAID"
  | "ATTENTION_OPENED";

export type WorkflowConditionOperator = "EQ" | "NEQ" | "IN";

export interface WorkflowConditionDTO {
  field: string;
  operator: WorkflowConditionOperator;
  value: unknown;
}

export type WorkflowActionType =
  | "CREATE_ATTENTION"
  | "SEND_EMAIL_TEMPLATE"
  | "SEND_WHATSAPP_TEMPLATE";

export interface WorkflowActionDTO {
  type: WorkflowActionType;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  summaryKey?: string;
  templateKey?: string;
  recipient?: "CUSTOMER_PRIMARY";
}

export interface WorkflowRuleDTO {
  id: string;
  workspaceId: string;
  branchId: string;
  code: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  publishedVersionNumber?: number;
  version: number;
  updatedAt: string;
}

export interface WorkflowRuleVersionDTO {
  id: string;
  workspaceId: string;
  branchId: string;
  ruleId: string;
  versionNumber: number;
  state: "DRAFT" | "PUBLISHED" | "RETIRED";
  eventType: WorkflowEventType;
  conditions: WorkflowConditionDTO[];
  actions: WorkflowActionDTO[];
  maxActionsPerEvent: number;
  basedOnVersionNumber?: number;
  publishedAt?: string;
  createdAt: string;
}

export interface WorkflowDefinitionValidationDTO {
  valid: boolean;
  code?: string;
  conditionCount: number;
  actionCount: number;
  hasExternalSend: boolean;
}
