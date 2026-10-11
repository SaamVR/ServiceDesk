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
    "A cleaner way to run your cleaning business.",
    "Everything a cleaning operations team needs to move work forward.",
    "Built for residential cleaning operations.",
    "Service quote pricing stays transparent and controlled.",
    "Connect the systems your operation already uses.",
    "See ServiceDesk against your real cleaning workflow.",
    "Help for the workflows your team uses every day.",
    "Privacy starts with workspace and role boundaries.",
    "Clear product boundaries before launch.",
    "Ready for what's next?",
  ];
  for (const title of expected) {
    assert.ok(script.includes(title), title);
    assert.ok(home.includes(title) || staticPage.includes(title) || signIn.includes(title), title);
  }
  assert.equal((script.match(/\{ slug: "(?:home|features|cleaning|pricing|integrations|contact|help|privacy|terms|sign-in)"/g) ?? []).length, 10);
});

test("public Chrome requires page-specific bright workboards rather than repeated V3 cards", () => {
  const script = file("scripts/release/v3-public-browser-proof.mjs");
  const component = file("src/features/product/BrightProductExperience.tsx");
  const home = file("src/features/product/BrightHomeExperience.tsx");
  const shell = file("src/components/shell/MarketingShell.tsx");
  const names = [
    "Illustrative AI-assisted service request",
    "Illustrative request-to-visit workboard",
    "Bright, tidy home illustrating cleaning-service operations",
    "Example service quote with transparent total and deposit",
    "Illustrative integration control system",
    "An illustrative cleaning workflow conversation",
    "help overview", "privacy overview", "terms overview",
  ];
  for (const name of names) {
    assert.ok(script.includes('heroLabel: "' + name + '"'), name);
    assert.ok(component.includes(name) || home.includes(name), name);
  }
  assert.ok(script.includes("state.heroLabel !== page.heroLabel"));
  assert.ok(shell.includes('brightEdition'));
  assert.ok(shell.includes('heroStory ? <ProductStoryHero kind={heroStory} /> : <OperationalFlowHero />'));
});

test("V4 public Chrome exercises local-only interactive workflows and mobile actions", () => {
  const script = file("scripts/release/v3-public-browser-proof.mjs");
  const pages = file("src/features/product/BrightPageInteractions.tsx");
  assert.ok(script.includes('page.slug === "home" && (width === 390 || width === 1280)'));
  assert.ok(script.includes("V4 product interaction failed"));
  assert.ok(script.includes("interactive-selected"));
  assert.ok(script.includes("a[data-public-primary],a[data-public-secondary]"));
  assert.ok(pages.includes('aria-pressed={'));
  assert.ok(!pages.includes("fetch("));
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

test("mobile header controls meet the 44 CSS pixel minimum and Chrome enforces it", () => {
  const css = file("src/components/shell/MarketingNavV3.module.css");
  const chrome = file("scripts/release/v3-public-browser-proof.mjs");
  assert.ok(css.includes("min-height: 44px;"));
  assert.ok(css.includes(".menuToggle { width: 44px; min-height: 44px;"));
  assert.ok(!css.includes("min-height: 41px;"));
  assert.ok(!css.includes("min-height: 39px;"));
  assert.ok(chrome.includes("state.touchTargets"));
  assert.ok(chrome.includes("item.w < 44 || item.h < 44"));
  assert.ok(chrome.includes("width <= 390 && page.heroLabel"));
  assert.ok(chrome.includes("Public mobile navigation/action target below 44 CSS pixels"));
});

test("real Chrome checks truthful page titles and blocks unapproved preview indexing", () => {
  const script = file("scripts/release/v3-public-browser-proof.mjs");
  const root = file("src/app/layout.tsx");
  assert.ok(script.includes("state.title.includes(\"ServiceDesk AI\")"));
  assert.ok(script.includes("state.title.includes(page.title)"));
  assert.ok(script.includes("state.metaDescription.length < 20"));
  assert.ok(script.includes('meta[name=robots]'));
  assert.ok(script.includes('process.env.SERVICEDESK_PUBLIC_INDEXING_ENABLED !== "true"'));
  assert.ok(script.includes("Unapproved public preview unexpectedly permits search engine indexing"));
  assert.ok(root.includes('index: publicIndexingEnabled'));
  assert.ok(root.includes('follow: publicIndexingEnabled'));
});

test("new Clean Air homepage retains semantic photo-led layouts and a real controllable AI explainer", () => {
  const proof = file("scripts/release/v3-public-browser-proof.mjs");
  const home = file("src/features/product/BrightHomeExperience.tsx");
  const ai = file("src/features/product/BrightHomeInteractions.tsx");
  const css = file("src/features/product/BrightHomeExperience.module.css");
  const page = file("src/app/page.tsx");
  assert.ok(page.includes("homeEdition"));
  assert.ok(page.includes("BrightHomeExperience"));
  assert.ok(home.includes("Illustrative AI-assisted service request"));
  assert.ok(home.includes("THE WAY WORK SHOULD FLOW"));
  assert.ok(home.includes("data-home-cta"));
  assert.ok(home.includes("data-home-link"));
  assert.ok(proof.includes('page.slug === "home" && (width === 390 || width === 1280)'));
  assert.ok(proof.includes("V4 public AI workflow interaction failed"));
  assert.ok(proof.includes("ai-scheduling-selected"));
  assert.ok(ai.includes('aria-pressed={selected === story.id}'));
  assert.ok(ai.includes("No AI request, booking, message or payment is sent."));
  assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"));
  assert.ok(css.includes('images.unsplash.com'));
  assert.ok(css.includes('color: #fff'));
});
