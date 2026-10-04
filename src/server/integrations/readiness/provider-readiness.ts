export type V1Provider = "WHATSAPP" | "GOOGLE_CALENDAR" | "PAYMENT" | "EMAIL" | "WEBHOOK_N8N" | "AI";
export type ProviderMode = "FIXTURE" | "SANDBOX" | "LIVE";
export type EvidenceState = "IMPLEMENTED" | "CONTRACT_TESTED" | "PROVIDER_VERIFIED";
export type ConfigurationState = "NOT_CONFIGURED" | "PARTIAL" | "CONFIGURED" | "REAUTH_REQUIRED" | "BLOCKED";
export type IntegrationStatus = "NOT_CONFIGURED" | "CONNECTED" | "DEGRADED" | "REAUTH_REQUIRED" | "BLOCKED";
export type EvidenceKind = "CONTROLLED_PROVIDER_RECEIPT" | "EXECUTABLE_CONTRACT_RECEIPT" | "CONFIGURATION" | "FIXTURE_2XX" | "AUTHORED_TEST" | "PRODUCT_UI" | "STALE_RECEIPT";

export interface ProviderEvidenceReference { operation: string; capturedAt: string; reference: string; buildSha?: string }
export interface ProviderReadinessInput { provider: V1Provider; mode?: ProviderMode; implementationState?: EvidenceState; configurationState?: ConfigurationState; configuredRequirements?: string[]; evidence?: ProviderEvidenceReference; blockers?: string[]; transientIssue?: string; reauthRequired?: boolean }
export interface ProviderReadinessReport { provider: V1Provider; mode: ProviderMode; implementationState: EvidenceState; configurationState: ConfigurationState; verificationState: EvidenceState | "CONFIGURATION_BLOCKED"; missingConfiguration: string[]; evidence?: ProviderEvidenceReference; blockers: string[]; canRunControlledProof: boolean; sandboxOnly: boolean; noClaimNotes: string[] }
export interface IntegrationStatusDTO { provider: V1Provider; mode: ProviderMode; status: IntegrationStatus; missingConfiguration: string[]; blockers: string[]; verificationState: ProviderReadinessReport["verificationState"] }
export interface ConnectorClosureReport { implementationStatus: "IMPLEMENTED" | "PARTIAL"; canonicalGate: "CONFIGURATION_BLOCKED" | "CONTRACT_TESTED" | "PROVIDER_VERIFIED"; controlledProviderGate: string[]; blockedProviders: V1Provider[]; missingConfiguration: Record<V1Provider, string[]>; verifiedOperations: Record<V1Provider, string[]>; sandboxOnlyProviders: V1Provider[]; noClaimNotes: string[] }

export interface ControlledProofManifest { provider: V1Provider; operation: string; mode: ProviderMode; buildSha: string; capturedAt: string; redactedProviderReceipt: string; result: "PASS" | "FAIL"; evidenceKind: EvidenceKind }
export interface ProofValidationInput { manifest: ControlledProofManifest; expectedProvider?: V1Provider; expectedOperation?: string; expectedBuildSha?: string; now: string; maxAgeHours?: number; stripeSandboxOnly?: boolean }
export interface PromotionDecision { allowed: boolean; code: string; message: string }

export const V1_PROVIDERS: readonly V1Provider[] = ["WHATSAPP", "GOOGLE_CALENDAR", "PAYMENT", "EMAIL", "WEBHOOK_N8N", "AI"] as const;
export const PROVIDER_REQUIREMENTS: Record<V1Provider, string[]> = {
  WHATSAPP: ["META_APP_ID", "META_BUSINESS_ACCOUNT_ID", "META_PHONE_NUMBER_ID", "APP_SECRET_SIGNATURE_VALIDATION", "ACCESS_TOKEN", "CONTROLLED_SENDER_RECIPIENT", "CALLBACK_URL", "VERIFY_TOKEN", "DURABLE_RECEIPT_CORE_HANDOFF"],
  GOOGLE_CALENDAR: ["OAUTH_CLIENT", "REDIRECT_URI", "REFRESH_TOKEN_TEST_ACCOUNT", "TEST_CALENDAR", "FREEBUSY_EVENTS_SCOPES", "FRESH_SYNC_STATE"],
  PAYMENT: ["STRIPE_STYLE_SANDBOX_CHECKOUT", "SIGNED_SANDBOX_WEBHOOK", "SANDBOX_IDEMPOTENCY", "SANDBOX_RECEIPT_FIXTURE"],
  EMAIL: ["EMAIL_PROVIDER_ACCOUNT", "EMAIL_API_KEY_REFERENCE", "VERIFIED_SENDER_DOMAIN", "CALLBACK_SIGNING_AUTH", "CONTROLLED_RECIPIENT"],
  WEBHOOK_N8N: ["AUTHORITATIVE_ENDPOINT", "SIGNING_SECRET_REFERENCE", "ALLOWED_HOST", "N8N_WORKFLOW_ID", "COMPLETION_CALLBACK_MAPPING"],
  AI: ["AI_PROVIDER_CONFIGURATION", "MODEL_HEALTH_CHECK", "MODEL_CONTRACT_PROOF", "NO_BUSINESS_AUTHORITY_BOUNDARY"],
};

const secretPatterns = [/sk_(live|test)_[A-Za-z0-9]+/i, /\bBearer\s+[A-Za-z0-9._~+\/=:-]+/i, /\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*[^\s,;}]+/i, /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/i];
const uniq = (items: string[]) => Array.from(new Set(items.filter(Boolean)));
const defaultMode = (provider: V1Provider): ProviderMode => provider === "PAYMENT" ? "SANDBOX" : "LIVE";
const hoursBetween = (a: string, b: string) => { const am = new Date(a).getTime(); const bm = new Date(b).getTime(); return Number.isFinite(am) && Number.isFinite(bm) ? Math.abs(am - bm) / 3_600_000 : Number.POSITIVE_INFINITY; };
export const containsSecretMaterial = (value: unknown) => secretPatterns.some((pattern) => pattern.test(typeof value === "string" ? value : JSON.stringify(value)));

function noClaimNotes(provider: V1Provider, mode: ProviderMode): string[] {
  const notes = ["Configuration, fixtures, authored tests, product UI state, and stale receipts do not imply provider verification."];
  if (provider === "PAYMENT") notes.push("Payment/Stripe is sandbox/demo only by owner policy; do not report it as LIVE or live-provider verified.");
  if (provider === "AI") notes.push("AI cannot grant pricing, payment, booking, or business authority.");
  if (mode !== "LIVE") notes.push(`Provider mode ${mode} is not live-provider proof.`);
  return notes;
}

export function buildProviderReadinessReport(input: ProviderReadinessInput): ProviderReadinessReport {
  const mode = input.provider === "PAYMENT" ? "SANDBOX" : input.mode ?? defaultMode(input.provider);
  const required = PROVIDER_REQUIREMENTS[input.provider];
  const configured = new Set(input.configuredRequirements ?? []);
  const missingConfiguration = required.filter((item) => !configured.has(item));
  const configurationState = input.reauthRequired ? "REAUTH_REQUIRED" : input.configurationState ?? (missingConfiguration.length === required.length ? "NOT_CONFIGURED" : missingConfiguration.length > 0 ? "PARTIAL" : "CONFIGURED");
  const blockers = uniq([...(input.blockers ?? []), ...missingConfiguration.map((item) => `MISSING_${item}`), ...(input.transientIssue ? [input.transientIssue] : [])]);
  const implementationState = input.implementationState ?? "IMPLEMENTED";
  const verificationState = input.provider === "PAYMENT" && mode === "SANDBOX" && implementationState === "PROVIDER_VERIFIED" ? "CONTRACT_TESTED" : implementationState;
  return { provider: input.provider, mode, implementationState, configurationState, verificationState, missingConfiguration, evidence: input.evidence, blockers, canRunControlledProof: configurationState === "CONFIGURED" && !blockers.some((item) => !item.startsWith("MISSING_")), sandboxOnly: input.provider === "PAYMENT" || mode === "SANDBOX", noClaimNotes: noClaimNotes(input.provider, mode) };
}

export function buildV1ProviderReadinessRegistry(inputs: ProviderReadinessInput[] = []): ProviderReadinessReport[] {
  const byProvider = new Map(inputs.map((item) => [item.provider, item] as const));
  return V1_PROVIDERS.map((provider) => buildProviderReadinessReport(byProvider.get(provider) ?? { provider }));
}

export function mapProviderReadinessToIntegrationStatus(report: ProviderReadinessReport): IntegrationStatusDTO {
  const status: IntegrationStatus = report.configurationState === "REAUTH_REQUIRED" ? "REAUTH_REQUIRED" : report.configurationState === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : report.configurationState === "BLOCKED" || report.missingConfiguration.length > 0 ? "BLOCKED" : report.blockers.some((item) => item.includes("TRANSIENT") || item.includes("DEGRADED")) ? "DEGRADED" : "CONNECTED";
  return { provider: report.provider, mode: report.mode, status, missingConfiguration: report.missingConfiguration, blockers: report.blockers, verificationState: report.verificationState };
}

export function buildConnectorClosureReport(reports: ProviderReadinessReport[], canonicalGate: ConnectorClosureReport["canonicalGate"] = "CONFIGURATION_BLOCKED"): ConnectorClosureReport {
  const missingConfiguration = Object.fromEntries(reports.map((report) => [report.provider, report.missingConfiguration])) as Record<V1Provider, string[]>;
  const verifiedOperations = Object.fromEntries(reports.map((report) => [report.provider, report.verificationState === "PROVIDER_VERIFIED" && report.evidence ? [report.evidence.operation] : []])) as Record<V1Provider, string[]>;
  return { implementationStatus: reports.every((report) => report.implementationState !== "IMPLEMENTED" || report.provider) ? "IMPLEMENTED" : "PARTIAL", canonicalGate, controlledProviderGate: reports.filter((report) => report.provider !== "PAYMENT" && report.verificationState !== "PROVIDER_VERIFIED").map((report) => report.provider), blockedProviders: reports.filter((report) => report.missingConfiguration.length > 0 || report.blockers.length > 0).map((report) => report.provider), missingConfiguration, verifiedOperations, sandboxOnlyProviders: reports.filter((report) => report.sandboxOnly).map((report) => report.provider), noClaimNotes: uniq(reports.flatMap((report) => report.noClaimNotes)) };
}

export function validateControlledProofManifest(input: ProofValidationInput): PromotionDecision {
  const manifest = input.manifest;
  if (input.expectedProvider && manifest.provider !== input.expectedProvider) return { allowed: false, code: "PROOF_PROVIDER_MISMATCH", message: "Controlled proof provider mismatch." };
  if (input.expectedOperation && manifest.operation !== input.expectedOperation) return { allowed: false, code: "PROOF_OPERATION_MISMATCH", message: "Controlled proof operation mismatch." };
  if (!manifest.buildSha || !/^[a-f0-9]{7,40}$/i.test(manifest.buildSha)) return { allowed: false, code: "PROOF_BUILD_MISSING", message: "Controlled proof must bind to a build SHA." };
  if (input.expectedBuildSha && manifest.buildSha !== input.expectedBuildSha) return { allowed: false, code: "PROOF_BUILD_MISMATCH", message: "Controlled proof build SHA mismatch." };
  if (manifest.result !== "PASS") return { allowed: false, code: "PROOF_RESULT_NOT_PASS", message: "Only passing controlled proof may verify a provider operation." };
  if (manifest.evidenceKind !== "CONTROLLED_PROVIDER_RECEIPT") return { allowed: false, code: "PROOF_NOT_CONTROLLED_PROVIDER_RECEIPT", message: "Provider verification requires a controlled provider receipt." };
  if (!manifest.redactedProviderReceipt || manifest.redactedProviderReceipt.trim().length < 6) return { allowed: false, code: "PROOF_RECEIPT_MISSING", message: "Controlled proof requires a redacted provider receipt/reference." };
  if (containsSecretMaterial(manifest)) return { allowed: false, code: "PROOF_SECRET_MATERIAL", message: "Controlled proof manifest contains secret-like material." };
  if (hoursBetween(input.now, manifest.capturedAt) > (input.maxAgeHours ?? 24)) return { allowed: false, code: "PROOF_STALE", message: "Controlled provider proof is stale." };
  if (manifest.provider === "PAYMENT" && input.stripeSandboxOnly !== false && manifest.mode === "LIVE") return { allowed: false, code: "PAYMENT_LIVE_PROOF_BLOCKED_BY_POLICY", message: "Payment is Stripe sandbox/demo only under current policy." };
  return { allowed: true, code: "PROOF_ACCEPTED", message: "Controlled proof manifest is valid." };
}

export function evaluateEvidencePromotion(input: { from: EvidenceState; to: EvidenceState; evidenceKind: EvidenceKind; executable?: boolean; controlledProof?: ControlledProofManifest; now: string; buildSha?: string }): PromotionDecision {
  if (input.from === input.to) return { allowed: true, code: "NOOP", message: "Evidence state unchanged." };
  if (input.from === "IMPLEMENTED" && input.to === "CONTRACT_TESTED") return input.evidenceKind === "EXECUTABLE_CONTRACT_RECEIPT" && input.executable ? { allowed: true, code: "CONTRACT_PROMOTION_ALLOWED", message: "Executable contract receipt may promote to CONTRACT_TESTED." } : { allowed: false, code: "CONTRACT_PROMOTION_REQUIRES_EXECUTABLE_RECEIPT", message: "Authored tests, fixtures, configuration, and UI state cannot promote to CONTRACT_TESTED without executable evidence." };
  if (input.to === "PROVIDER_VERIFIED") {
    if (!input.controlledProof) return { allowed: false, code: "PROVIDER_PROMOTION_REQUIRES_CONTROLLED_RECEIPT", message: "Provider verification requires a controlled provider receipt." };
    const proof = validateControlledProofManifest({ manifest: input.controlledProof, expectedBuildSha: input.buildSha, now: input.now, stripeSandboxOnly: true });
    if (!proof.allowed) return proof;
    if (input.controlledProof.provider === "PAYMENT" && input.controlledProof.mode === "SANDBOX") return { allowed: false, code: "STRIPE_SANDBOX_CANNOT_PROMOTE_LIVE_PROVIDER", message: "Stripe sandbox proof cannot become live PROVIDER_VERIFIED evidence." };
    return { allowed: true, code: "PROVIDER_PROMOTION_ALLOWED", message: "Fresh controlled provider receipt may promote to PROVIDER_VERIFIED." };
  }
  return { allowed: false, code: "PROMOTION_NOT_ALLOWED", message: "Evidence promotion must follow IMPLEMENTED -> CONTRACT_TESTED -> PROVIDER_VERIFIED." };
}

export function buildV1ProviderReadinessSystem(inputs: ProviderReadinessInput[], canonicalGate: ConnectorClosureReport["canonicalGate"] = "CONFIGURATION_BLOCKED") {
  const providers = buildV1ProviderReadinessRegistry(inputs);
  return { providers, integrationStatuses: providers.map(mapProviderReadinessToIntegrationStatus), closure: buildConnectorClosureReport(providers, canonicalGate) };
}
