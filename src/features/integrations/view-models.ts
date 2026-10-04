import type { IntegrationStatusDTO } from "@/contracts";

export type ConnectorStage =
  | "WHATSAPP_INBOUND"
  | "WHATSAPP_OUTBOUND_POLICY"
  | "WHATSAPP_STATUS"
  | "CALENDAR"
  | "PAYMENT"
  | "RECOVERY";

export type ConnectorEvidenceState =
  | "OBSERVED_FIXTURE"
  | "POLICY_ONLY"
  | "NO_PROVIDER_RECEIPT"
  | "SANDBOX_ONLY"
  | "PROVIDER_VERIFIED";

export interface ConnectorEvidenceSample {
  stage: ConnectorStage;
  label: string;
  state: ConnectorEvidenceState;
  detail: string;
}

export interface ConnectorOperationsView {
  providerVerified: boolean;
  releaseLabel: "PROVIDER_VERIFIED" | "CONFIGURATION_BLOCKED";
  steps: Array<{
    stage: ConnectorStage;
    label: string;
    detail: string;
    proofLabel: string;
    integrationStatus?: string;
    tone: "success" | "attention" | "pending" | "failure";
  }>;
}

const stageProvider: Partial<Record<ConnectorStage, IntegrationStatusDTO["provider"]>> = {
  WHATSAPP_INBOUND: "WHATSAPP",
  WHATSAPP_OUTBOUND_POLICY: "WHATSAPP",
  WHATSAPP_STATUS: "WHATSAPP",
  CALENDAR: "GOOGLE_CALENDAR",
  PAYMENT: "PAYMENT",
};

function proofLabel(state: ConnectorEvidenceState): string {
  switch (state) {
    case "PROVIDER_VERIFIED":
      return "Controlled provider receipt verified";
    case "SANDBOX_ONLY":
      return "Sandbox evidence only";
    case "POLICY_ONLY":
      return "Policy UI only";
    case "OBSERVED_FIXTURE":
      return "Observed fixture only";
    case "NO_PROVIDER_RECEIPT":
      return "No provider receipt";
  }
}

function toneFor(state: ConnectorEvidenceState): ConnectorOperationsView["steps"][number]["tone"] {
  switch (state) {
    case "PROVIDER_VERIFIED":
      return "success";
    case "SANDBOX_ONLY":
    case "POLICY_ONLY":
    case "OBSERVED_FIXTURE":
      return "pending";
    case "NO_PROVIDER_RECEIPT":
      return "attention";
  }
}

function integrationLabel(integration?: IntegrationStatusDTO): string | undefined {
  if (!integration) return undefined;
  const mode = integration.mode ? ` · ${integration.mode.replace("_", " ")}` : "";
  return `${integration.status.replaceAll("_", " ")}${mode}`;
}

export function buildConnectorOperationsView({
  integrations,
  evidence,
}: {
  integrations: readonly IntegrationStatusDTO[];
  evidence: readonly ConnectorEvidenceSample[];
}): ConnectorOperationsView {
  const steps = evidence.map((sample) => {
    const provider = stageProvider[sample.stage];
    const integration = provider
      ? integrations.find((candidate) => candidate.provider === provider)
      : undefined;

    return {
      stage: sample.stage,
      label: sample.label,
      detail: sample.detail,
      proofLabel: proofLabel(sample.state),
      integrationStatus: integrationLabel(integration),
      tone: toneFor(sample.state),
    };
  });

  const providerVerified =
    steps.length > 0 &&
    evidence.every((sample) => sample.state === "PROVIDER_VERIFIED");

  return {
    providerVerified,
    releaseLabel: providerVerified ? "PROVIDER_VERIFIED" : "CONFIGURATION_BLOCKED",
    steps,
  };
}
