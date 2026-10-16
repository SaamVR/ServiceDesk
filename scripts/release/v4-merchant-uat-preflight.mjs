#!/usr/bin/env node
/**
 * Read-only, offline acceptance preflight. Never contacts Supabase, Render,
 * providers or customers and never upgrades self-reported counts to UAT PASS.
 * Supply only redacted aggregate evidence collected by an authorized operator:
 *   node scripts/release/v4-merchant-uat-preflight.mjs /tmp/redacted-evidence.json
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const SHA = /^[a-f0-9]{40}$/;
const countKeys = ["workspaces", "activeServices", "activeUsdBranchBooks",
  "requests", "quotes", "workflowExecutions", "invoices", "outboxEvents",
  "outboundMessages"];

export function assessMerchantUatPreflight(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return {status:"EVIDENCE_INVALID", acceptanceVerified:false, blockers:["Aggregate evidence must be a redacted JSON object."]};
  const { expectedReviewSha, reportedLiveSha, counts, fictionalOwnerSessions,
    externalEffectsDisabled, provenance } = input;
  if (!SHA.test(expectedReviewSha ?? "") || !SHA.test(reportedLiveSha ?? "") ||
      provenance !== "READ_ONLY_DATABASE_AGGREGATES" ||
      !counts || typeof counts !== "object" || Array.isArray(counts) ||
      countKeys.some(key=>!Number.isSafeInteger(counts[key]) || counts[key] < 0) ||
      !Number.isSafeInteger(fictionalOwnerSessions) ||
      fictionalOwnerSessions < 0 || fictionalOwnerSessions > 100 ||
      typeof externalEffectsDisabled !== "boolean") {
    return {status:"EVIDENCE_INVALID", acceptanceVerified:false,
      blockers:["Missing or malformed source identity, read-only aggregate provenance, session counts or external-send control."]};
  }
  const blockers = [];
  const requiredWork = [];
  if (expectedReviewSha !== reportedLiveSha)
    blockers.push("The reported LIVE SHA does not match the intended review candidate; repeat exact deployment and guest gate.");
  if (externalEffectsDisabled !== true)
    blockers.push("External sends/charges must remain disabled for this internal merchant rehearsal.");
  if (fictionalOwnerSessions < 2)
    blockers.push("Two distinct authorized fictional owner sessions are required for tenant A/B positive and negative tests.");
  if (counts.workspaces < 2)
    blockers.push("An authorized second isolated fictional workspace is needed for two-tenant isolation testing.");
  if (counts.activeServices === 0)
    requiredWork.push("Use the real authenticated owner Settings action to persist active service catalog entries.");
  if (counts.activeUsdBranchBooks === 0)
    requiredWork.push("Enter authorized fictional-business USD prices through first-run Settings and read back the saved branch price book.");
  if (counts.requests === 0)
    requiredWork.push("Create a consented fictional cleaning request through an authorized application workflow.");
  if (counts.quotes === 0)
    requiredWork.push("Generate an actual saved quote from priced request facts; reload and verify lines, expiry and deposit.");
  if (counts.workflowExecutions === 0)
    requiredWork.push("With opted-in internal automation, verify a causally linked persisted quote-accepted workflow and tenant-scoped attention.");
  if (counts.invoices === 0)
    requiredWork.push("Verify invoice creation/read-back separately; do not infer it from accepted quote or quote totals.");
  if (counts.outboxEvents === 0 || counts.outboundMessages === 0)
    requiredWork.push("Keep provider delivery UNVERIFIED until an explicitly authorized, controlled receipt is collected; internal rehearsal sends none.");
  return {
    status: blockers.length > 0 ? "BLOCKED_PREREQUISITES" :
      requiredWork.length > 0 ? "SIGNED_IN_REHEARSAL_REQUIRED" : "READY_FOR_INDEPENDENT_ACCEPTANCE_REVIEW",
    acceptanceVerified: false,
    evidenceClass: "OPERATOR_REPORTED_PREFLIGHT_NOT_LIVE_UAT",
    blockers, requiredWork,
    disclaimer: "Counts and flags are untrusted operator declarations, not signed-in transaction receipts. Even an empty checklist is never an automatic UAT PASS.",
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    if (process.argv.length !== 3) throw Error("Supply exactly one redacted JSON evidence file.");
    const data = readFileSync(resolve(process.argv[2]), "utf8");
    if (Buffer.byteLength(data, "utf8") > 8192) throw Error("Evidence file too large.");
    const assessment = assessMerchantUatPreflight(JSON.parse(data));
    console.log(JSON.stringify(assessment, null, 2));
    if (assessment.status === "EVIDENCE_INVALID" || assessment.status === "BLOCKED_PREREQUISITES")
      process.exitCode = 1;
  } catch {
    console.error("UAT_PREFLIGHT_INVALID_INPUT: use a redacted aggregate-only JSON file.");
    process.exitCode = 2;
  }
}
