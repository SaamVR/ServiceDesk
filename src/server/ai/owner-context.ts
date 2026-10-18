import type { ActorContext, Result } from "../../contracts";
import type { RedactedProviderEvidence } from "../integrations/types";
import { explainOwnerMetric, OWNER_METRICS, type OwnerMetricSnapshot } from "./owner-assistant";

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

const PROVIDERS = new Set(["WHATSAPP","GOOGLE_CALENDAR","PAYMENT","EMAIL","WEBHOOK","AI"]);
const VERIFICATIONS = new Set(["CONTRACT_TESTED","PROVIDER_VERIFIED","CONFIGURATION_BLOCKED"]);
/** Reject hidden fields/accessors before the AI context can treat only the
 * visible subset as verified evidence. */
function plainVisibleDataRecord(value:unknown):value is Record<string,unknown> {
  if(!value || typeof value!=="object" || Array.isArray(value) ||
     Object.getPrototypeOf(value)!==Object.prototype)return false;
  const descriptors=Object.getOwnPropertyDescriptors(value);
  return Reflect.ownKeys(value).length===Object.keys(value).length &&
    Object.values(descriptors).every(desc=>Object.hasOwn(desc,"value"));
}
function exactUtc(value:unknown):value is string {
  if(typeof value!=="string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))return false;
  const t=Date.parse(value);
  return Number.isFinite(t) && new Date(t).toISOString()===value;
}
/** Provider diagnostics may contain untrusted callback text or PII, so no
 * freeform provider strings are ever forwarded into the owner AI context. */
function providerSafeSummary(item:OwnerProviderSummary):OwnerProviderSummary {
  return {
    provider:item.provider,
    evidenceVerification:item.evidenceVerification,
    summary:item.evidenceVerification==="PROVIDER_VERIFIED"
      ? "Provider evidence verified; inspect the saved provider receipts for details."
      : item.evidenceVerification==="CONTRACT_TESTED"
      ? "Provider contract tested only; no live delivery is confirmed."
      : "Provider configuration is blocked; operator action is required.",
  };
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

  // Revalidate the same metrics exposed by the read-only owner assistant.
  // A poisoned metric, malformed interval or guessed provenance must not
  // be propagated into a larger generative owner brief.
  if(!exactUtc(input.now) || input.metrics.source!=="CORE_METRICS" ||
     !exactUtc(input.metrics.from) || !exactUtc(input.metrics.to) ||
     Date.parse(input.metrics.from)>Date.parse(input.metrics.to) ||
     Date.parse(input.metrics.to)-Date.parse(input.metrics.from)>366*86400_000 ||
     !plainVisibleDataRecord(input.metrics.metrics) ||
     Object.keys(input.metrics.metrics).length===0 ||
     Object.keys(input.metrics.metrics).some(name=>!OWNER_METRICS.includes(name as (typeof OWNER_METRICS)[number]) ||
       !explainOwnerMetric(input.actor,input.metrics,name).ok)) {
    return {ok:false,code:"OWNER_CONTEXT_METRICS_UNVERIFIED",
      message:"Owner context requires verified saved metric evidence."};
  }
  if(!Array.isArray(input.providerSummaries??[]) ||
     (input.providerSummaries??[]).length>12 ||
     (input.providerSummaries??[]).some(item=>!plainVisibleDataRecord(item) ||
       Object.keys(item).length!==3 ||
       !["provider","evidenceVerification","summary"].every(key=>Object.hasOwn(item,key)) ||
       !PROVIDERS.has(item.provider) || !VERIFICATIONS.has(item.evidenceVerification) ||
       typeof item.summary!=="string" || item.summary.length>3000)) {
    return {ok:false,code:"OWNER_CONTEXT_PROVIDER_UNVERIFIED",
      message:"Provider verification evidence must be a bounded known status."};
  }
  const providerSummaries = (input.providerSummaries ?? []).map(providerSafeSummary);

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
