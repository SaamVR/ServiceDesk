import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_DIMENSIONS = Object.freeze([
  "implementation", "technical", "integration", "deployed", "persistence",
  "userExperience", "aiAutomation", "security", "reliability", "businessEffectiveness",
]);
const STATES = new Set(["PASS", "PARTIAL", "FAIL", "BLOCKED"]);

export function validateCriticAcceptance(ledger) {
  const errors = [];
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger))
    return ["Ledger must be an object."];
  if (!/^[0-9a-f]{40}$/.test(ledger.sourceSha ?? ""))
    errors.push("sourceSha must be an exact Git commit SHA.");
  if (ledger.deployedSha != null && !/^[0-9a-f]{40}$/.test(ledger.deployedSha))
    errors.push("deployedSha must be a Git commit SHA when provided.");
  if (!STATES.has(ledger.verdict))
    errors.push("Overall verdict must be PASS, PARTIAL, FAIL or BLOCKED.");
  if (typeof ledger.commercialReady !== "boolean")
    errors.push("commercialReady must be a boolean.");
  for (const key of REQUIRED_DIMENSIONS) {
    const row = ledger.dimensions?.[key];
    if (!row || !STATES.has(row.status)) {
      errors.push(key + ": missing/invalid dimension verdict.");
      continue;
    }
    if (!Array.isArray(row.evidence) ||
        row.evidence.some(link => typeof link !== "string" ||
          !/^https:\/\/github\.com\/SaamVR\/ServiceDesk\//.test(link))) {
      errors.push(key + ": evidence must be a list of repository GitHub links.");
    }
    if (row.status === "PASS" && (!row.evidence || row.evidence.length === 0))
      errors.push(key + ": PASS without an attributable evidence link.");
    if (row.status === "PASS" &&
        ["deployed", "persistence", "userExperience", "aiAutomation", "businessEffectiveness"]
          .includes(key) && row.proofMode !== "AUTHORIZED_REAL") {
      errors.push(key + ": real-world PASS needs AUTHORIZED_REAL evidence.");
    }
  }
  if (ledger.dimensions?.deployed?.status === "PASS" &&
      ledger.deployedSha !== ledger.sourceSha)
    errors.push("Deployed PASS requires exactly the accepted source SHA.");
  if (ledger.verdict === "PASS" && REQUIRED_DIMENSIONS.some(
    key => ledger.dimensions?.[key]?.status !== "PASS"))
    errors.push("Overall PASS requires all mandatory dimensions PASS.");
  if (ledger.commercialReady &&
      (ledger.verdict !== "PASS" || REQUIRED_DIMENSIONS.some(
        key => ledger.dimensions?.[key]?.status !== "PASS")))
    errors.push("Commercial readiness cannot bypass incomplete acceptance.");
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: node scripts/release/critic-acceptance-ledger.mjs <ledger.json>");
    process.exitCode = 2;
  } else {
    let errors;
    try {
      const ledger = JSON.parse(readFileSync(path, "utf8"));
      errors = validateCriticAcceptance(ledger);
      if (!errors.length) console.log("CRITIC_LEDGER_STRUCTURALLY_VALID", ledger.verdict,
        "commercialReady=" + ledger.commercialReady, "source=" + ledger.sourceSha);
    } catch (cause) {
      errors = ["Unable to parse critic ledger: " + (cause instanceof Error ? cause.message : "unknown")];
    }
    if (errors.length) {
      for (const message of errors) console.error("CRITIC_INVALID:", message);
      process.exitCode = 1;
    }
  }
}
