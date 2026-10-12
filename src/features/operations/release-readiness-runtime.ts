import type { OperationalIntegrationHealth } from "./integration-health-runtime";

export type OperationalReleaseState =
  | "CONTRACT_TESTED"
  | "PROVIDER_VERIFIED"
  | "OPERATIONS_VERIFIED"
  | "CONFIGURATION_BLOCKED"
  | "BUYER_EVIDENCE_BLOCKED";

export interface OperationalReleaseGateView {
  id: string;
  label: string;
  state: OperationalReleaseState;
  blocking: boolean;
  note: string;
}

export interface OperationalReleaseReadinessView {
  buildSha?: string;
  productionReleaseReady: boolean;
  blockingCount: number;
  gates: OperationalReleaseGateView[];
}

type RuntimeEnvironment = Record<string, string | undefined>;

const receiptPattern = /^[a-z0-9-]+:redacted:[A-Za-z0-9._:-]{3,160}$/i;
const shaPattern = /^[a-f0-9]{7,40}$/i;

function exactBuildReceipt(input: {
  env: RuntimeEnvironment;
  receiptKey: string;
  buildKey: string;
  currentBuildSha?: string;
}): boolean {
  const receipt = input.env[input.receiptKey]?.trim() ?? "";
  const evidenceBuild = input.env[input.buildKey]?.trim() ?? "";
  if (!input.currentBuildSha || !receiptPattern.test(receipt) || !shaPattern.test(evidenceBuild)) return false;
  return evidenceBuild === input.currentBuildSha;
}

export function buildOperationalReleaseReadiness(
  integrations: OperationalIntegrationHealth[],
  env: RuntimeEnvironment = process.env,
): OperationalReleaseReadinessView {
  const buildSha = (
    env.SERVICEDESK_BUILD_SHA
    ?? env.RENDER_GIT_COMMIT
    ?? env.VERCEL_GIT_COMMIT_SHA
    ?? ""
  ).trim() || undefined;

  const canonicalExecutable = exactBuildReceipt({
    env,
    receiptKey: "SERVICEDESK_CANONICAL_RC_RECEIPT",
    buildKey: "SERVICEDESK_CANONICAL_RC_BUILD_SHA",
    currentBuildSha: buildSha,
  });
  const browserAccepted = exactBuildReceipt({
    env,
    receiptKey: "SERVICEDESK_BROWSER_ACCEPTANCE_RECEIPT",
    buildKey: "SERVICEDESK_BROWSER_ACCEPTANCE_BUILD_SHA",
    currentBuildSha: buildSha,
  });
  const staffBrowserReference = env.SERVICEDESK_STAFF_BROWSER_ACCEPTANCE_RECEIPT?.trim() ?? "";
  const staffBrowserAccepted = exactBuildReceipt({
    env,
    receiptKey: "SERVICEDESK_STAFF_BROWSER_ACCEPTANCE_RECEIPT",
    buildKey: "SERVICEDESK_STAFF_BROWSER_ACCEPTANCE_BUILD_SHA",
    currentBuildSha: buildSha,
  }) && staffBrowserReference.startsWith("staff-browser:redacted:")
    && staffBrowserReference !== env.SERVICEDESK_BROWSER_ACCEPTANCE_RECEIPT?.trim();
  const migrationRehearsed = exactBuildReceipt({
    env,
    receiptKey: "SERVICEDESK_MIGRATION_REHEARSAL_RECEIPT",
    buildKey: "SERVICEDESK_MIGRATION_REHEARSAL_BUILD_SHA",
    currentBuildSha: buildSha,
  });

  // CI and disposable PG17 rehearsal cannot stand in for real deployed
  // schema or signed-in business events. Receipts must be scope-specific,
  // non-reused and bound to this exact application build.
  const liveProof = (key: string, shaKey: string, prefix: string) =>
    (env[key]?.trim() ?? "").startsWith(prefix) && exactBuildReceipt({
      env, receiptKey: key, buildKey: shaKey, currentBuildSha: buildSha,
    });
  const schema = liveProof("SERVICEDESK_SCHEMA_APPLIED_RECEIPT",
    "SERVICEDESK_SCHEMA_APPLIED_BUILD_SHA", "schema-applied:redacted:");
  const owner = liveProof("SERVICEDESK_OWNER_JOURNEY_RECEIPT",
    "SERVICEDESK_OWNER_JOURNEY_BUILD_SHA", "owner-journey:redacted:");
  const attention = liveProof("SERVICEDESK_QUOTE_ATTENTION_RECEIPT",
    "SERVICEDESK_QUOTE_ATTENTION_BUILD_SHA", "quote-attention:redacted:");

  const gates: OperationalReleaseGateView[] = [
    {
      id: "CANONICAL_EXECUTABLE",
      label: "Exact-build executable RC",
      state: canonicalExecutable ? "CONTRACT_TESTED" : "CONFIGURATION_BLOCKED",
      blocking: true,
      note: canonicalExecutable
        ? "A redacted RC receipt is bound to this exact build SHA."
        : "Attach the exact-build RC receipt; source state or an old build receipt does not qualify.",
    },
    {
      id: "RESPONSIVE_BROWSER",
      label: "Responsive browser acceptance",
      state: browserAccepted ? "OPERATIONS_VERIFIED" : "CONFIGURATION_BLOCKED",
      blocking: true,
      note: browserAccepted
        ? "Desktop, tablet and mobile acceptance evidence is bound to this build."
        : "Real-browser desktop/tablet/mobile acceptance is still required.",
    },
    {
      id: "AUTHENTICATED_STAFF_BROWSER",
      label: "Authenticated staff browser workflows",
      state: staffBrowserAccepted ? "OPERATIONS_VERIFIED" : "CONFIGURATION_BLOCKED",
      blocking: true,
      note: staffBrowserAccepted
        ? "A distinct authenticated staff workflow receipt is bound to this exact build."
        : "Public-page smoke tests do not prove authenticated staff sessions, branch roles, or operational workflows.",
    },
    {
      id: "MIGRATION_REHEARSAL",
      label: "Migration upgrade / rollback rehearsal",
      state: migrationRehearsed ? "OPERATIONS_VERIFIED" : "CONFIGURATION_BLOCKED",
      blocking: true,
      note: migrationRehearsed
        ? "A disposable non-production rehearsal receipt is bound to this build."
        : "A synthetic disposable upgrade/rollback/cleanup rehearsal is still required.",
    },
    {
      id: "STAGING_SCHEMA_APPLIED",
      label: "Applied operational database migrations",
      state: schema ? "OPERATIONS_VERIFIED" : "CONFIGURATION_BLOCKED",
      blocking: true,
      note: schema
        ? "An independently reviewed connected-database schema receipt is bound to this build."
        : "Source migration rehearsal does not establish that the branch-trigger repair or pricing RPC is installed in connected staging.",
    },
    {
      id: "OWNER_FIRST_RUN_JOURNEY",
      label: "Real authenticated cleaning workflow",
      state: owner ? "OPERATIONS_VERIFIED" : "CONFIGURATION_BLOCKED",
      blocking: true,
      note: owner
        ? "An authenticated owner request-to-quote workflow receipt is bound to this build."
        : "Owner-entered services, actual branch rates, customer request and quote readback are not yet accepted by real staged sessions.",
    },
    {
      id: "QUOTE_ACCEPTED_INTERNAL_ATTENTION",
      label: "Saved accepted-quote internal automation",
      state: attention ? "OPERATIONS_VERIFIED" : "CONFIGURATION_BLOCKED",
      blocking: true,
      note: attention
        ? "A persisted internal event and attention receipt is bound to this build."
        : "Configured AI, published rules, synthetic previews or a server opt-in cannot substitute for persisted event/attention and tenant-isolation evidence.",
    },
  ];

  for (const integration of integrations) {
    if (integration.provider === "PAYMENT") {
      gates.push({
        id: "PAYMENT_SANDBOX",
        label: "Payment sandbox authority",
        state: "CONTRACT_TESTED",
        blocking: false,
        note: "Sandbox/demo only; never interpreted as live-payment provider verification.",
      });
      continue;
    }
    const verified = integration.verificationState === "PROVIDER_VERIFIED";
    gates.push({
      id: "PROVIDER_" + integration.provider,
      label: integration.label + " provider proof",
      state: verified ? "PROVIDER_VERIFIED" : "CONFIGURATION_BLOCKED",
      blocking: true,
      note: verified
        ? "Controlled provider evidence is recorded for the supported operation."
        : "Implementation/configuration alone is not provider verification.",
    });
  }

  gates.push(
    {
      id: "OPERATOR_RUNBOOK",
      label: "Release/operator runbook",
      state: "CONTRACT_TESTED",
      blocking: true,
      note: "Repository runbook documents evidence-safe release and rollback procedure.",
    },
    {
      id: "SECOND_VERTICAL",
      label: "Second vertical buyer evidence",
      state: "BUYER_EVIDENCE_BLOCKED",
      blocking: false,
      note: "Only Cleaning is released. Two real buyers with the same model are required before a second vertical.",
    },
  );

  const blockingCount = gates.filter((gate) =>
    gate.blocking
    && !["CONTRACT_TESTED", "PROVIDER_VERIFIED", "OPERATIONS_VERIFIED"].includes(gate.state))
    .length;

  return {
    buildSha,
    productionReleaseReady: blockingCount === 0,
    blockingCount,
    gates,
  };
}
