import test from "node:test";
import assert from "node:assert/strict";
import { classifyCriticScope, renderCriticScopeReport } from "../critic-change-scope.mjs";

test("flags distinct high-risk code paths without claiming acceptance", () => {
  const report = classifyCriticScope([
    "supabase/migrations/0063_durable_quote.sql",
    "src/server/ai/owner-operations-brief.ts",
    "src/server/integrations/email.ts",
    "src/features/operations/Quotes.tsx",
    ".github/workflows/v4-exact-live-review-guest-gate.yml",
  ]);
  assert.equal(report.paths, 5);
  const summary = renderCriticScopeReport(report);
  for (const required of [
    "Database / tenant authorization", "AI model / agents",
    "External providers / automation", "Authenticated UX / business journeys",
    "Release / test infrastructure", "REVIEW REQUIRED", "negative two-tenant RLS",
  ]) assert.ok(summary.includes(required), required);
  assert.ok(!summary.includes("UAT PASS"));
});
test("recognizes backend persistence independent of visual frontend review", () => {
  const report = classifyCriticScope(["src/server/core/quote-repository.ts"]);
  assert.deepEqual(report.categories.map(x => x.name), [
    "Backend financial / persisted commands",
  ]);
});
test("does not classify documentation-only changes as business acceptance", () => {
  const report = classifyCriticScope(["docs/control-tower/critic/review.md"]);
  assert.equal(report.categories.length, 0);
  assert.match(renderCriticScopeReport(report), /not an executed feature acceptance certificate/);
});
test("deduplicates changed paths and rejects malformed untrusted input", () => {
  assert.equal(classifyCriticScope(["README.md", "README.md"]).paths, 1);
  assert.throws(() => classifyCriticScope(["src/server/ai/ok.ts", "bad\npath"]), /Malformed/);
  assert.throws(() => classifyCriticScope(null), /Malformed/);
});
