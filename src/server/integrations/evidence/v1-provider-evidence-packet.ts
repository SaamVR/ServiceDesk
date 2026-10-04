export type V1Provider = "WHATSAPP" | "GOOGLE_CALENDAR" | "PAYMENT" | "EMAIL" | "WEBHOOK_N8N" | "AI";
export type V1ProviderMode = "FIXTURE" | "SANDBOX" | "LIVE";
export type V1EvidenceKind = "CONTROLLED_PROVIDER_RECEIPT" | "INJECTED_TRANSPORT" | "FIXTURE" | "AUTHORED_TEST";
export type V1ProofResult = "PASS" | "FAIL";
export type V1OperationStatus = "VERIFIED" | "MISSING" | "SANDBOX_ONLY";

export interface V1RequiredProviderOperation { provider: V1Provider; operation: string; mode: V1ProviderMode; description: string; requiresControlledProviderReceipt: boolean; sandboxOnly?: boolean }
export interface V1ControlledProofManifest { provider: V1Provider; operation: string; mode: V1ProviderMode; buildSha: string; capturedAt: string; redactedProviderReference: string; result: V1ProofResult; evidenceKind: V1EvidenceKind; notes?: string[] }
export interface V1ProofManifestValidation { ok: boolean; manifest?: V1ControlledProofManifest; code?: string; message?: string }
export interface V1ProviderOperationEvidence { provider: V1Provider; operation: string; mode: V1ProviderMode; status: V1OperationStatus; proofReference?: string; capturedAt?: string; blocker?: string }
export interface V1ProviderEvidencePacket { buildSha: string; requiredOperations: V1RequiredProviderOperation[]; verifiedOperations: V1ProviderOperationEvidence[]; missingOperations: V1ProviderOperationEvidence[]; sandboxOnlyOperations: V1ProviderOperationEvidence[]; staleOrMismatchedEvidence: V1ProofManifestValidation[]; blockers: string[]; overallControlledProviderGate: "READY" | "CONFIGURATION_BLOCKED" }
export interface V1ProviderGateReportItem { provider: V1Provider; implementationStatus: "IMPLEMENTED"; contractStatus: "CONTRACT_EVIDENCE_PRESENT" | "CONTRACT_EVIDENCE_MISSING"; controlledProofStatus: "COMPLETE" | "MISSING" | "SANDBOX_ONLY"; missingConfiguration: string[]; nextOwnerAction: string }
export interface V1CrossProviderJourneyPreflight { buildSha: string; pass: boolean; mutatesCoreTruth: false; contractEvidenceOnly: boolean; steps: Array<{ step: string; provider?: V1Provider; operation?: string; status: "READY_FOR_CONTROLLED_PROOF" | "BLOCKED_ON_CONTROLLED_PROOF" }>; blockers: string[] }
export interface V1ReleaseProviderClaim { buildSha: string; provider: V1Provider; operation: string; mode: V1ProviderMode; proofReference: string; evidenceKind: V1EvidenceKind }

export const V1_REQUIRED_PROVIDER_OPERATIONS: V1RequiredProviderOperation[] = [
  ["WHATSAPP", "inbound_verified_webhook", "LIVE", "Inbound webhook signature verification"], ["WHATSAPP", "durable_receipt_core_handoff", "LIVE", "Durable receipt and Core handoff"], ["WHATSAPP", "outbound_accepted", "LIVE", "Outbound accepted by Meta"], ["WHATSAPP", "delivery_read_failure_callback", "LIVE", "Status callbacks"],
  ["GOOGLE_CALENDAR", "fresh_freebusy", "LIVE", "Fresh freebusy"], ["GOOGLE_CALENDAR", "visit_upsert", "LIVE", "Visit upsert"], ["GOOGLE_CALENDAR", "cancellation", "LIVE", "Visit cancellation"], ["GOOGLE_CALENDAR", "reconciliation_external_edit_review", "LIVE", "External edit review"],
  ["PAYMENT", "stripe_sandbox_checkout", "SANDBOX", "Stripe sandbox checkout", true], ["PAYMENT", "stripe_sandbox_webhook", "SANDBOX", "Stripe sandbox webhook", true], ["PAYMENT", "core_payment_application", "SANDBOX", "Core payment application", true],
  ["EMAIL", "send_accepted", "LIVE", "Email send accepted"], ["EMAIL", "delivered", "LIVE", "Email delivered callback"], ["EMAIL", "bounce_complaint_callback", "LIVE", "Bounce/complaint callback"],
  ["WEBHOOK_N8N", "signed_delivery", "LIVE", "Signed delivery"], ["WEBHOOK_N8N", "retryable_final_classification", "LIVE", "Retry/final classification"], ["WEBHOOK_N8N", "n8n_completion_callback", "LIVE", "n8n completion callback"],
  ["AI", "model_health", "LIVE", "Model health"], ["AI", "controlled_extraction_intent", "LIVE", "Controlled extraction/intent"], ["AI", "no_business_authority", "LIVE", "No pricing/payment/role authority"],
].map(([provider, operation, mode, description, sandboxOnly]) => ({ provider: provider as V1Provider, operation: operation as string, mode: mode as V1ProviderMode, description: description as string, requiresControlledProviderReceipt: true, sandboxOnly: Boolean(sandboxOnly) || undefined }));

const missingConfigurationByProvider: Record<V1Provider, string[]> = {
  WHATSAPP: ["Meta app/account IDs", "app secret/signature validation", "access token", "controlled sender/recipient", "callback URL/verify token"],
  GOOGLE_CALENDAR: ["OAuth client", "redirect URI", "refresh token/test account", "test calendar", "freebusy/events scopes", "fresh sync state"],
  PAYMENT: ["Stripe-style sandbox test keys/events only; live Stripe intentionally not required by owner policy"],
  EMAIL: ["provider account/API key reference", "verified sender/domain", "callback signing/auth", "controlled recipient"],
  WEBHOOK_N8N: ["authoritative endpoint", "signing-secret reference", "allowlist", "n8n workflow", "completion callback mapping"],
  AI: ["configured model/provider key reference", "model health check", "model contract proof", "no-business-authority boundary"],
};

const providers: V1Provider[] = ["WHATSAPP", "GOOGLE_CALENDAR", "PAYMENT", "EMAIL", "WEBHOOK_N8N", "AI"];
const key = (provider: V1Provider, operation: string) => `${provider}:${operation}`;
const time = (value: string) => { const ms = new Date(value).getTime(); return Number.isFinite(ms) ? ms : Number.NaN; };
const validSha = (value: string) => /^[a-f0-9]{7,64}$/i.test(value);
const hasSecret = (value: unknown) => /(sk_live_|sk_test_|whsec_|Bearer\s+[A-Za-z0-9._~+\/-]+|access_token|refresh_token|client_secret|api[_-]?key\s*[:=]|signing[_-]?secret\s*[:=]|xox[baprs]-|AIza[0-9A-Za-z_-]+)/i.test(JSON.stringify(value ?? ""));

export function validateV1ControlledProofManifest(input: { manifest: V1ControlledProofManifest; acceptedBuildSha: string; now: string; maxAgeHours?: number }): V1ProofManifestValidation {
  const manifest = input.manifest;
  const required = V1_REQUIRED_PROVIDER_OPERATIONS.find((item) => item.provider === manifest.provider && item.operation === manifest.operation);
  if (!required) return { ok: false, manifest, code: "UNKNOWN_OPERATION", message: "Operation is outside the V1 provider matrix." };
  if (!validSha(manifest.buildSha) || manifest.buildSha !== input.acceptedBuildSha) return { ok: false, manifest, code: "BUILD_SHA_MISMATCH", message: "Proof must bind the accepted build SHA." };
  if (manifest.result !== "PASS") return { ok: false, manifest, code: "PROOF_NOT_PASSING", message: "Only PASS proofs can verify operations." };
  if (manifest.evidenceKind !== "CONTROLLED_PROVIDER_RECEIPT") return { ok: false, manifest, code: "NOT_PROVIDER_RECEIPT", message: "Fixture/injected/authored evidence cannot become provider proof." };
  if (!manifest.redactedProviderReference || manifest.redactedProviderReference.trim().length < 4) return { ok: false, manifest, code: "MISSING_REDACTED_REFERENCE", message: "A redacted provider reference is required." };
  if (hasSecret(manifest)) return { ok: false, manifest, code: "SECRET_BEARING_PROOF", message: "Proof contains secret-like material." };
  if (manifest.mode !== required.mode) return { ok: false, manifest, code: "MODE_MISMATCH", message: "Proof mode does not match required operation mode." };
  if (manifest.provider === "PAYMENT" && manifest.mode === "LIVE") return { ok: false, manifest, code: "STRIPE_LIVE_POLICY_INVALID", message: "Payment remains Stripe SANDBOX/DEMO only." };
  const captured = time(manifest.capturedAt); const now = time(input.now);
  if (!Number.isFinite(captured) || !Number.isFinite(now)) return { ok: false, manifest, code: "INVALID_TIMESTAMP", message: "capturedAt/now must be valid timestamps." };
  if (captured > now || now - captured > (input.maxAgeHours ?? 72) * 60 * 60 * 1000) return { ok: false, manifest, code: "STALE_PROOF", message: "Proof is stale or future-dated." };
  return { ok: true, manifest };
}

export function buildV1ProviderEvidencePacket(input: { buildSha: string; manifests: V1ControlledProofManifest[]; now: string; maxAgeHours?: number }): V1ProviderEvidencePacket {
  const validations = input.manifests.map((manifest) => validateV1ControlledProofManifest({ manifest, acceptedBuildSha: input.buildSha, now: input.now, maxAgeHours: input.maxAgeHours }));
  const accepted = new Map(validations.filter((item) => item.ok && item.manifest).map((item) => [key(item.manifest!.provider, item.manifest!.operation), item.manifest!]));
  const verifiedOperations: V1ProviderOperationEvidence[] = [];
  const missingOperations: V1ProviderOperationEvidence[] = [];
  const sandboxOnlyOperations: V1ProviderOperationEvidence[] = [];
  const blockers: string[] = [];
  for (const required of V1_REQUIRED_PROVIDER_OPERATIONS) {
    const proof = accepted.get(key(required.provider, required.operation));
    if (proof) {
      const item: V1ProviderOperationEvidence = { provider: required.provider, operation: required.operation, mode: required.mode, status: required.sandboxOnly ? "SANDBOX_ONLY" : "VERIFIED", proofReference: proof.redactedProviderReference, capturedAt: proof.capturedAt };
      (required.sandboxOnly ? sandboxOnlyOperations : verifiedOperations).push(item);
    } else {
      const item: V1ProviderOperationEvidence = { provider: required.provider, operation: required.operation, mode: required.mode, status: required.sandboxOnly ? "SANDBOX_ONLY" : "MISSING", blocker: required.sandboxOnly ? "SANDBOX_CONTROLLED_PROOF_REQUIRED" : "CONTROLLED_PROVIDER_PROOF_REQUIRED" };
      (required.sandboxOnly ? sandboxOnlyOperations : missingOperations).push(item);
      blockers.push(`${required.provider}:${required.operation}:${item.blocker}`);
    }
  }
  const staleOrMismatchedEvidence = validations.filter((item) => !item.ok);
  if (staleOrMismatchedEvidence.length) blockers.push("STALE_OR_MISMATCHED_EVIDENCE_REJECTED");
  return { buildSha: input.buildSha, requiredOperations: V1_REQUIRED_PROVIDER_OPERATIONS, verifiedOperations, missingOperations, sandboxOnlyOperations, staleOrMismatchedEvidence, blockers, overallControlledProviderGate: blockers.length ? "CONFIGURATION_BLOCKED" : "READY" };
}

export function buildV1ProviderGateReport(packet: V1ProviderEvidencePacket, contractEvidenceProviders: V1Provider[] = []): V1ProviderGateReportItem[] {
  return providers.map((provider) => {
    const required = packet.requiredOperations.filter((item) => item.provider === provider);
    const missing = packet.missingOperations.filter((item) => item.provider === provider);
    const sandbox = packet.sandboxOnlyOperations.filter((item) => item.provider === provider);
    const allSandbox = required.every((item) => item.sandboxOnly);
    const complete = missing.length === 0 && (!allSandbox || sandbox.every((item) => item.proofReference));
    return { provider, implementationStatus: "IMPLEMENTED", contractStatus: contractEvidenceProviders.includes(provider) ? "CONTRACT_EVIDENCE_PRESENT" : "CONTRACT_EVIDENCE_MISSING", controlledProofStatus: allSandbox ? "SANDBOX_ONLY" : complete ? "COMPLETE" : "MISSING", missingConfiguration: missingConfigurationByProvider[provider], nextOwnerAction: allSandbox ? "Run Stripe sandbox proof only; do not request live Stripe." : `Provide controlled ${provider} configuration and receipts for: ${missing.map((item) => item.operation).join(", ") || "none"}.` };
  });
}

export function buildV1CrossProviderJourneyPreflight(input: { buildSha: string; packet: V1ProviderEvidencePacket; contractEvidenceProviders: V1Provider[] }): V1CrossProviderJourneyPreflight {
  const journey: Array<{ step: string; provider?: V1Provider; operation?: string }> = [
    { step: "WhatsApp/web enquiry", provider: "WHATSAPP", operation: "inbound_verified_webhook" }, { step: "AI extraction where applicable", provider: "AI", operation: "controlled_extraction_intent" }, { step: "request/quote", provider: "AI", operation: "no_business_authority" }, { step: "calendar availability", provider: "GOOGLE_CALENDAR", operation: "fresh_freebusy" }, { step: "Stripe sandbox deposit", provider: "PAYMENT", operation: "stripe_sandbox_checkout" }, { step: "confirmation outbox", provider: "WHATSAPP", operation: "outbound_accepted" }, { step: "WhatsApp/Email confirmation", provider: "EMAIL", operation: "send_accepted" }, { step: "reminder", provider: "EMAIL", operation: "delivered" }, { step: "calendar visit projection", provider: "GOOGLE_CALENDAR", operation: "visit_upsert" }, { step: "crew lifecycle" }, { step: "quality/manual payment", provider: "PAYMENT", operation: "core_payment_application" }, { step: "optional n8n webhook", provider: "WEBHOOK_N8N", operation: "signed_delivery" },
  ];
  const steps = journey.map((item) => ({ ...item, status: !item.provider || input.contractEvidenceProviders.includes(item.provider) ? "READY_FOR_CONTROLLED_PROOF" as const : "BLOCKED_ON_CONTROLLED_PROOF" as const }));
  const blockers = steps.filter((item) => item.status === "BLOCKED_ON_CONTROLLED_PROOF").map((item) => `${item.provider}:${item.operation}:CONTRACT_EVIDENCE_MISSING`);
  if (input.packet.overallControlledProviderGate !== "READY") blockers.push("CONTROLLED_PROVIDER_PROOF_REQUIRED_BEFORE_RELEASE_CLAIM");
  return { buildSha: input.buildSha, pass: blockers.every((item) => item === "CONTROLLED_PROVIDER_PROOF_REQUIRED_BEFORE_RELEASE_CLAIM"), mutatesCoreTruth: false, contractEvidenceOnly: true, steps, blockers };
}

export function validateV1ReleaseProviderClaim(packet: V1ProviderEvidencePacket, claim: V1ReleaseProviderClaim): V1ProofManifestValidation {
  if (claim.buildSha !== packet.buildSha) return { ok: false, code: "RELEASE_BUILD_MISMATCH", message: "Release claim build SHA must match packet build SHA." };
  if (claim.evidenceKind !== "CONTROLLED_PROVIDER_RECEIPT") return { ok: false, code: "FALSE_PROVIDER_CLAIM", message: "Fixture/injected/authored evidence cannot be represented as provider proof." };
  if (claim.provider === "PAYMENT" && claim.mode === "LIVE") return { ok: false, code: "STRIPE_LIVE_POLICY_INVALID", message: "Stripe/payment cannot be claimed live under current policy." };
  const verified = [...packet.verifiedOperations, ...packet.sandboxOnlyOperations].some((item) => item.provider === claim.provider && item.operation === claim.operation && item.proofReference === claim.proofReference && (item.status === "VERIFIED" || Boolean(item.proofReference)));
  if (!verified) return { ok: false, code: "REQUIRED_OPERATION_MISSING", message: "Operation has no accepted proof in the packet." };
  return { ok: true };
}

export function buildSmallestExternalAccessPacket(report: V1ProviderGateReportItem[]): string[] {
  return report.filter((item) => item.provider !== "PAYMENT").map((item) => `${item.provider}: ${item.nextOwnerAction} Missing config: ${item.missingConfiguration.join("; ")}`);
}
