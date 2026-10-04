export type ConnectorRegressionProvider = "WHATSAPP" | "GOOGLE_CALENDAR" | "PAYMENT" | "EMAIL" | "WEBHOOK" | "AI";

export type ConnectorRegressionProviderState =
  | "TRANSIENT_FAILURE"
  | "PERMANENT_FAILURE"
  | "CONFIGURATION_BLOCKED"
  | "STALE_STATE"
  | "OUT_OF_ORDER"
  | "DUPLICATE";

export type ConnectorRegressionAction =
  | "RETRY"
  | "DEAD_LETTER"
  | "BLOCKED_CONFIGURATION"
  | "RECONCILE"
  | "IGNORE_STALE"
  | "ACK_DUPLICATE"
  | "OPERATOR_REVIEW";

export interface ConnectorRegressionInput {
  provider: ConnectorRegressionProvider;
  scenario: string;
  providerState: ConnectorRegressionProviderState;
  attempts: number;
  maxAttempts: number;
}

export interface ConnectorRegressionDecision {
  provider: ConnectorRegressionProvider;
  scenario: string;
  providerState: ConnectorRegressionProviderState;
  action: ConnectorRegressionAction;
  retryable: boolean;
  terminal: boolean;
  businessMutationAllowed: false;
  providerVerified: false;
  notes: string[];
}

export interface ConnectorRegressionSummary {
  total: number;
  retryable: number;
  blocked: number;
  terminal: number;
  providerVerifiedClaims: number;
  businessMutationAllowed: false;
}

export function classifyConnectorRegression(input: ConnectorRegressionInput): ConnectorRegressionDecision {
  const base = {
    provider: input.provider,
    scenario: input.scenario,
    providerState: input.providerState,
    businessMutationAllowed: false as const,
    providerVerified: false as const,
  };

  if (input.providerState === "DUPLICATE") {
    return { ...base, action: "ACK_DUPLICATE", retryable: false, terminal: true, notes: ["Duplicate provider signal acknowledged through idempotency; business truth is unchanged."] };
  }

  if (input.providerState === "OUT_OF_ORDER") {
    return { ...base, action: "IGNORE_STALE", retryable: false, terminal: true, notes: ["Out-of-order provider signal ignored to prevent state regression."] };
  }

  if (input.providerState === "STALE_STATE") {
    return { ...base, action: "RECONCILE", retryable: false, terminal: false, notes: ["Provider state is stale; controller/core reconciliation is required before truth changes."] };
  }

  if (input.providerState === "CONFIGURATION_BLOCKED") {
    return { ...base, action: "BLOCKED_CONFIGURATION", retryable: false, terminal: true, notes: ["Provider configuration is incomplete; no live provider verification can be claimed."] };
  }

  if (input.providerState === "PERMANENT_FAILURE") {
    return { ...base, action: "OPERATOR_REVIEW", retryable: false, terminal: true, notes: ["Permanent provider failure requires operator review or dead-letter handling."] };
  }

  if (input.attempts >= input.maxAttempts) {
    return { ...base, action: "DEAD_LETTER", retryable: false, terminal: true, notes: ["Retry budget exhausted; route to dead-letter/operator review."] };
  }

  return { ...base, action: "RETRY", retryable: true, terminal: false, notes: ["Transient provider failure can retry with original idempotency key."] };
}

export function summarizeConnectorRegressionMatrix(items: ConnectorRegressionDecision[]): ConnectorRegressionSummary {
  return items.reduce<ConnectorRegressionSummary>(
    (summary, item) => {
      summary.total += 1;
      if (item.retryable) summary.retryable += 1;
      if (item.action === "BLOCKED_CONFIGURATION") summary.blocked += 1;
      if (item.terminal) summary.terminal += 1;
      if (item.providerVerified) summary.providerVerifiedClaims += 1;
      return summary;
    },
    { total: 0, retryable: 0, blocked: 0, terminal: 0, providerVerifiedClaims: 0, businessMutationAllowed: false },
  );
}
