import type { AttentionItemDTO, IntegrationStatusDTO } from "@/contracts";

export type RecoveryKind =
  | "DELIVERY_UNCERTAIN"
  | "CALENDAR_STALE"
  | "PAYMENT_REVIEW";

export type RecoveryState =
  | "RECONCILE_REQUIRED"
  | "RECONNECT_REQUIRED"
  | "HUMAN_REVIEW_REQUIRED";

export interface RecoveryFixture {
  id: string;
  kind: RecoveryKind;
  resourceId: string;
  state: RecoveryState;
  ownerUserId?: string;
  summary: string;
}

export interface RecoveryActionView {
  releaseLabel: "CONFIGURATION_BLOCKED" | "IMPLEMENTED";
  items: Array<{
    id: string;
    kind: RecoveryKind;
    summary: string;
    ownerLabel: string;
    action: string;
    proofLabel: string;
    canExecuteAutomatically: false;
    linkedAttentionCount: number;
    providerStatus?: string;
  }>;
}

function actionFor(kind: RecoveryKind): string {
  switch (kind) {
    case "DELIVERY_UNCERTAIN":
      return "Reconcile provider state before retry";
    case "CALENDAR_STALE":
      return "Reconnect or refresh calendar before confirmation";
    case "PAYMENT_REVIEW":
      return "Review payment and capacity before confirming visit";
  }
}

function proofFor(kind: RecoveryKind): string {
  switch (kind) {
    case "DELIVERY_UNCERTAIN":
      return "No provider delivery proof";
    case "CALENDAR_STALE":
      return "Calendar freshness not verified";
    case "PAYMENT_REVIEW":
      return "Verified payment event still requires capacity review";
  }
}

function providerFor(kind: RecoveryKind): IntegrationStatusDTO["provider"] | undefined {
  switch (kind) {
    case "DELIVERY_UNCERTAIN":
      return "WHATSAPP";
    case "CALENDAR_STALE":
      return "GOOGLE_CALENDAR";
    case "PAYMENT_REVIEW":
      return "PAYMENT";
  }
}

export function buildRecoveryActionsView({
  attentionItems,
  integrations,
  recoveryFixtures,
}: {
  attentionItems: readonly AttentionItemDTO[];
  integrations: readonly IntegrationStatusDTO[];
  recoveryFixtures: readonly RecoveryFixture[];
}): RecoveryActionView {
  const items = recoveryFixtures.map((fixture) => {
    const provider = providerFor(fixture.kind);
    const integration = provider
      ? integrations.find((candidate) => candidate.provider === provider)
      : undefined;

    return {
      id: fixture.id,
      kind: fixture.kind,
      summary: fixture.summary,
      ownerLabel: fixture.ownerUserId ?? "Unassigned",
      action: actionFor(fixture.kind),
      proofLabel: proofFor(fixture.kind),
      canExecuteAutomatically: false as const,
      linkedAttentionCount: attentionItems.filter(
        (item) =>
          item.resourceId === fixture.resourceId ||
          item.type === fixture.kind,
      ).length,
      providerStatus: integration
        ? `${integration.status.replaceAll("_", " ")}${integration.mode ? ` · ${integration.mode}` : ""}`
        : undefined,
    };
  });

  const configurationBlocked = integrations.some(
    (integration) =>
      integration.mode !== "LIVE" ||
      integration.status !== "CONNECTED",
  );

  return {
    releaseLabel: configurationBlocked ? "CONFIGURATION_BLOCKED" : "IMPLEMENTED",
    items,
  };
}
