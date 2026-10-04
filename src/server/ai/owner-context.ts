import type { ActorContext, Result } from "../../contracts";
import type { RedactedProviderEvidence } from "../integrations/types";
import type { OwnerMetricSnapshot } from "./owner-assistant";

export interface OwnerProviderSummary {
  provider: RedactedProviderEvidence["provider"];
  evidenceVerification: RedactedProviderEvidence["verification"];
  summary: string;
}

export interface OwnerAssistantSafeContext {
  workspaceId: string;
  actorRole: "OWNER";
  generatedAt: string;
  readOnly: true;
  aiAuthoritative: false;
  canMutateBusinessTruth: false;
  metrics: OwnerMetricSnapshot["metrics"];
  metricRange: Pick<OwnerMetricSnapshot, "from" | "to">;
  providerSummaries: OwnerProviderSummary[];
  sources: Array<"CORE_METRICS" | "PROVIDER_SUMMARY">;
}

function redactText(value: string): string {
  return value
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/sk_(live|test)_[A-Za-z0-9_\-]+/g, "[redacted-secret]")
    .replace(/whsec_[A-Za-z0-9_\-]+/g, "[redacted-secret]");
}

export function buildOwnerAssistantContext(input: {
  actor: ActorContext;
  now: string;
  metrics: OwnerMetricSnapshot;
  providerSummaries?: OwnerProviderSummary[];
}): Result<OwnerAssistantSafeContext> {
  if (input.actor.role !== "OWNER") {
    return { ok: false, code: "OWNER_ROLE_REQUIRED", message: "Owner assistant context requires an owner actor." };
  }

  if (input.actor.workspaceId !== input.metrics.workspaceId) {
    return { ok: false, code: "WORKSPACE_MISMATCH", message: "Owner assistant context cannot cross workspace boundaries." };
  }

  const providerSummaries = (input.providerSummaries ?? []).map((summary) => ({
    provider: summary.provider,
    evidenceVerification: summary.evidenceVerification,
    summary: redactText(summary.summary),
  }));

  return {
    ok: true,
    value: {
      workspaceId: input.metrics.workspaceId,
      actorRole: "OWNER",
      generatedAt: input.now,
      readOnly: true,
      aiAuthoritative: false,
      canMutateBusinessTruth: false,
      metrics: { ...input.metrics.metrics },
      metricRange: { from: input.metrics.from, to: input.metrics.to },
      providerSummaries,
      sources: providerSummaries.length > 0 ? ["CORE_METRICS", "PROVIDER_SUMMARY"] : ["CORE_METRICS"],
    },
  };
}
