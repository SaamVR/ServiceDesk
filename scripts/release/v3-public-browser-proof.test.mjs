import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const file = (p) => readFileSync(resolve(root, p), "utf8");

test("public Chrome harness is executable Node source and never opens a staff workspace", () => {
  const path = resolve(root, "scripts/release/v3-public-browser-proof.mjs");
  const syntax = spawnSync(process.execPath, ["--check", path], { encoding: "utf8", timeout: 5000 });
  assert.equal(syntax.status, 0, syntax.stderr);
  const script = file("scripts/release/v3-public-browser-proof.mjs");
  assert.ok(script.includes('const origin = "http://127.0.0.1:3000"'));
  assert.ok(script.includes("PUBLIC_ONLY_BROWSER_CAPTURED_NOT_STAFF_ACCEPTED"));
  assert.ok(!script.includes('path: "/app/'));
  assert.ok(!script.includes('path: "/api/'));
  assert.ok(script.includes('page.slug + "-" + width + "-" + type + ".png"'));
  assert.ok(script.includes('await loaded(page)'));
  assert.ok(script.includes("state.heading === page.title"));
});

test("real Chrome expected headings agree with route-authored product text", () => {
  const script = file("scripts/release/v3-public-browser-proof.mjs");
  const home = file("src/app/page.tsx");
  const staticPage = file("src/features/product/StaticProductPage.tsx");
  const signIn = file("src/app/auth/sign-in/page.tsx");
  const expected = [
    "Run cleaning operations from enquiry to paid job.",
    "Everything a cleaning operations team needs to move work forward.",
    "Service quote pricing stays transparent and controlled.",
    "Connect the systems your operation already uses.",
    "See ServiceDesk against your real cleaning workflow.",
    "Ready for what's next?",
  ];
  for (const title of expected) {
    assert.ok(script.includes(title), title);
    assert.ok(home.includes(title) || staticPage.includes(title) || signIn.includes(title), title);
  }
  assert.equal((script.match(/\{ slug: "(?:home|features|pricing|integrations|contact|sign-in)"/g) ?? []).length, 6);
});

test("public Chrome requires different authored storyboards instead of a repeated default illustration", () => {
  const script = file("scripts/release/v3-public-browser-proof.mjs");
  const component = file("src/components/shell/ProductStoryHero.tsx");
  const shell = file("src/components/shell/MarketingShell.tsx");
  for (const name of [
    "Four stages of the cleaning operations workflow",
    "Feature workflow from intake through quality",
    "Illustrative service quote breakdown, not subscription prices",
    "Integration readiness categories, not live provider status",
    "ServiceDesk walkthrough preparation agenda",
  ]) {
    assert.ok(script.includes('heroLabel: "' + name + '"'), name);
    assert.ok(component.includes(name) || file("src/components/shell/OperationalFlowHero.tsx").includes(name));
  }
  assert.ok(script.includes("state.heroLabel !== page.heroLabel"));
  assert.ok(shell.includes('heroStory ? <ProductStoryHero kind={heroStory} /> : <OperationalFlowHero />'));
});

test("browser acceptance remains fully public, five-width, no secrets, and labelled as partial evidence", () => {
  const script = file("scripts/release/v3-public-browser-proof.mjs");
  assert.ok(script.includes("const widths = [320, 390, 834, 1280, 1440]"));
  assert.ok(script.includes("prefers-reduced-motion"));
  assert.ok(script.includes("Public horizontal overflow"));
  assert.ok(script.includes('V3_PUBLIC_CHECKOUT_SHA'));
  assert.ok(script.includes("No authenticated staff proof."));
  assert.ok(!script.includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert.ok(!script.includes("api/internal/inbox/reply"));
});
