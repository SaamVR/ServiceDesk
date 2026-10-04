export type SubscriptionPlan = "TRIAL" | "STARTER" | "GROWTH";
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED";

export interface SubscriptionStateInput {
  workspaceId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  now: string;
  trialEndsAt?: string;
  currentPeriodEndsAt?: string;
}

export interface SubscriptionEntitlement {
  workspaceId: string;
  state: "ALLOW" | "DEGRADED" | "BLOCK";
  reason?: "TRIAL_EXPIRED" | "PAYMENT_PAST_DUE" | "SUBSCRIPTION_CANCELLED";
  aiEnabled: boolean;
  integrationsEnabled: boolean;
  ownerInsightsEnabled: boolean;
  billingMutationAllowed: false;
}

export type OwnerInsightType = "ATTENTION_QUEUE" | "PAYMENT_RISK" | "CAPACITY_RISK" | "HEALTHY";
export type OwnerInsightSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface OwnerIntelligenceInput {
  workspaceId: string;
  generatedAt: string;
  aggregates: {
    openRequests: number;
    unansweredConversations: number;
    overdueInvoicesMinor: number;
    crewCapacityMinutes: number;
    bookedServiceMinutes: number;
  };
  samples?: string[];
}

export interface OwnerInsightCard {
  type: OwnerInsightType;
  severity: OwnerInsightSeverity;
  title: string;
  body: string;
  metric: number;
}

export interface OwnerIntelligenceDigest {
  workspaceId: string;
  generatedAt: string;
  cards: OwnerInsightCard[];
  evidence: {
    source: "AGGREGATE_OPERATIONAL_SIGNALS";
    piiIncluded: false;
    sampleCountIgnored: number;
  };
}

function expiredAt(value: string | undefined, now: string): boolean {
  if (!value) return false;
  return new Date(value).getTime() <= new Date(now).getTime();
}

export function evaluateSubscriptionEntitlement(input: SubscriptionStateInput): SubscriptionEntitlement {
  const base = {
    workspaceId: input.workspaceId,
    billingMutationAllowed: false as const,
  };

  if (input.status === "CANCELLED") {
    return {
      ...base,
      state: "BLOCK",
      reason: "SUBSCRIPTION_CANCELLED",
      aiEnabled: false,
      integrationsEnabled: false,
      ownerInsightsEnabled: false,
    };
  }

  if (input.status === "TRIALING" && expiredAt(input.trialEndsAt, input.now)) {
    return {
      ...base,
      state: "BLOCK",
      reason: "TRIAL_EXPIRED",
      aiEnabled: false,
      integrationsEnabled: false,
      ownerInsightsEnabled: true,
    };
  }

  if (input.status === "PAST_DUE") {
    return {
      ...base,
      state: "DEGRADED",
      reason: "PAYMENT_PAST_DUE",
      aiEnabled: false,
      integrationsEnabled: false,
      ownerInsightsEnabled: true,
    };
  }

  return {
    ...base,
    state: "ALLOW",
    aiEnabled: true,
    integrationsEnabled: input.plan === "GROWTH",
    ownerInsightsEnabled: true,
  };
}

export function buildOwnerIntelligenceDigest(input: OwnerIntelligenceInput): OwnerIntelligenceDigest {
  const cards: OwnerInsightCard[] = [];
  const capacityRatio = input.aggregates.crewCapacityMinutes === 0 ? 1 : input.aggregates.bookedServiceMinutes / input.aggregates.crewCapacityMinutes;

  if (input.aggregates.unansweredConversations >= 3 || input.aggregates.openRequests >= 10) {
    cards.push({
      type: "ATTENTION_QUEUE",
      severity: input.aggregates.unansweredConversations >= 5 ? "CRITICAL" : "WARNING",
      title: "Attention queue needs review",
      body: "Aggregate request and conversation volume suggests staff should review the queue.",
      metric: input.aggregates.unansweredConversations,
    });
  }

  if (input.aggregates.overdueInvoicesMinor > 0) {
    cards.push({
      type: "PAYMENT_RISK",
      severity: input.aggregates.overdueInvoicesMinor >= 100_000 ? "CRITICAL" : "WARNING",
      title: "Overdue invoice balance detected",
      body: "Aggregate overdue balance should be reviewed before additional manual follow-up.",
      metric: input.aggregates.overdueInvoicesMinor,
    });
  }

  if (capacityRatio > 1) {
    cards.push({
      type: "CAPACITY_RISK",
      severity: capacityRatio >= 1.5 ? "CRITICAL" : "WARNING",
      title: "Crew capacity is overbooked",
      body: "Booked service minutes exceed aggregate available crew capacity.",
      metric: Math.round(capacityRatio * 100),
    });
  }

  if (cards.length === 0) {
    cards.push({
      type: "HEALTHY",
      severity: "INFO",
      title: "Operations look stable",
      body: "Aggregate operational signals do not show urgent owner attention items.",
      metric: 0,
    });
  }

  return {
    workspaceId: input.workspaceId,
    generatedAt: input.generatedAt,
    cards,
    evidence: {
      source: "AGGREGATE_OPERATIONAL_SIGNALS",
      piiIncluded: false,
      sampleCountIgnored: input.samples?.length ?? 0,
    },
  };
}
