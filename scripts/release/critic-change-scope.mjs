/** Independent Critic review-scope triage for the exact pull-request merge tree.
 * Does not claim to run tests, verify deployments, or replace reviewer sign-off.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RULES = [
  { name: "Database / tenant authorization", match: /^supabase\/migrations\//,
    ask: "Run isolated PG17 migrations, negative two-tenant RLS tests, and saved readback before any approved staging application." },
  { name: "Backend financial / persisted commands", match: /^src\/server\/core\//,
    ask: "Show atomic persistence and retry/idempotency outcomes, monetary ledger checks, and tenant/branch authorization." },
  { name: "AI model / agents", match: /^src\/server\/ai\//,
    ask: "Demonstrate actual configured model output only with authorization, safe tool boundaries, grounding, negative hallucination cases, and cost controls." },
  { name: "External providers / automation", match: /^src\/server\/(?:integrations|jobs)\//,
    ask: "Check trigger-to-durable-outcome, dedupe, provider callback identity, retries, and authorized sandbox delivery receipts." },
  { name: "Authenticated UX / business journeys", match: /^src\/(?:app|features|components)\//,
    ask: "Verify signed-in role-scoped desktop/mobile actions, expected saved business state, and real user usability." },
  { name: "Release / test infrastructure", match: /^(?:\.github\/workflows\/|scripts\/release\/)/,
    ask: "Recheck exact HEAD, CI failure modes, release controls, and deployed source identity; no green CI implies live UAT." },
];
export function classifyCriticScope(paths) {
  if (!Array.isArray(paths) || paths.some(path => typeof path !== "string" ||
      !path.trim() || path.includes("\0") || path.includes("\n")))
    throw new Error("Malformed list of changed file paths");
  const unique = [...new Set(paths)];
  return {
    paths: unique.length,
    categories: RULES.filter(rule => unique.some(path => rule.match.test(path)))
      .map(({name,ask}) => ({name,ask})),
  };
}
export function renderCriticScopeReport(report) {
  const lines = [
    "### Independent Critic: PR review scope",
    "",
    "Status: **REVIEW REQUIRED** — this is a change-risk checklist, not an executed feature acceptance certificate.",
    "",
    `Changed paths: ${report.paths}.`,
    "",
  ];
  if (!report.categories.length)
    lines.push("No mapped high-risk application areas changed; still review the actual diff and evidence.");
  else for (const category of report.categories)
    lines.push(`- **${category.name}**: ${category.ask}`);
  lines.push("", "A separate operator/reviewer must verify real UAT, tenant scope, persistence, deployment and external sends wherever applicable.");
  return lines.join("\n");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node scripts/release/critic-change-scope.mjs changed-paths.txt");
    process.exitCode = 2;
  } else {
    try {
      const paths = readFileSync(input, "utf8").split(/\r?\n/).filter(Boolean);
      console.log(renderCriticScopeReport(classifyCriticScope(paths)));
    } catch (error) {
      console.error("CRITIC_SCOPE_INVALID", error instanceof Error ? error.message : "unknown");
      process.exitCode = 1;
    }
  }
}
