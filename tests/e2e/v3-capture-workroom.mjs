#!/usr/bin/env node
/**
 * Real Chromium acceptance capture, never fixture screenshots.
 * Run only against a separately authorized, authenticated nonproduction preview.
 *
 * Example:
 * V3_QA_ISOLATED=1 V3_QA_BASE_URL=https://approved-preview.example \
 * V3_QA_WORKSPACE=qa-workspace V3_QA_PROFILE_DIR=/secure/qa-chrome-profile \
 * V3_QA_EXPECTED_SHA=<deployed-sha> node tests/e2e/v3-capture-workroom.mjs
 *
 * The supplied SHA is recorded as a CLAIM, not verified against a deployment.
 * Verify the host's exact deployed source independently before acceptance.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const env = process.env;
function requireInput(name) {
  const value = env[name]?.trim();
  if (!value) throw new Error("Missing required QA configuration: " + name);
  return value;
}
const isolated = requireInput("V3_QA_ISOLATED");
if (isolated !== "1") throw new Error("A separately authorized isolated preview is required.");
const base = new URL(requireInput("V3_QA_BASE_URL"));
if (!["https:", "http:"].includes(base.protocol)) throw new Error("Unsupported preview protocol.");
if (base.username || base.password || base.search || base.hash) throw new Error("Preview URL must not contain credentials or query parameters.");
if (base.protocol === "http:" && !["localhost", "127.0.0.1"].includes(base.hostname)) throw new Error("Nonlocal previews must use HTTPS.");
if (base.pathname !== "/" && base.pathname !== "") throw new Error("Use preview origin only, without a pathname.");
const workspace = requireInput("V3_QA_WORKSPACE");
const expectedSha = requireInput("V3_QA_EXPECTED_SHA");
if (!/^[a-f0-9]{40}$/i.test(expectedSha)) throw new Error("Expected source SHA must be a 40-character hex commit ID.");
const profile = resolve(requireInput("V3_QA_PROFILE_DIR"));
if (!existsSync(profile) || !statSync(profile).isDirectory()) {
  throw new Error("Use an existing preauthenticated nonproduction Chromium profile; none was found.");
}
const executable = env.V3_QA_CHROMIUM || "/usr/bin/chromium";
if (!existsSync(executable)) throw new Error("Chromium executable not found. Set V3_QA_CHROMIUM.");
const out = resolve(env.V3_QA_OUTPUT || join(tmpdir(), "servicedesk-v3-visual-qa"));
if (out === process.cwd() || out.startsWith(process.cwd() + "/")) {
  throw new Error("Private screenshot evidence must not be created inside the repository.");
}
mkdirSync(out, { recursive: true });
const widths = [320, 390, 834, 1280, 1440];
const modules = ["overview", "inbox", "schedule", "requests", "quotes", "customers"];
const results = [];
const flags = [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  "--disable-extensions", "--disable-background-networking",
  "--disable-dev-shm-usage", "--virtual-time-budget=3500",
  "--user-data-dir=" + profile,
];
if (typeof process.getuid === "function" && process.getuid() === 0) flags.push("--no-sandbox");

function chromium(args, timeout) {
  const p = spawnSync(executable, [...flags, ...args], {
    encoding: "utf8", timeout, maxBuffer: 4 * 1024 * 1024,
  });
  if (p.error || p.status !== 0) {
    throw new Error("Chromium failed (exit " + String(p.status) + "); check preview and QA profile.");
  }
  return p.stdout;
}

for (const module of modules) {
  const path = "/app/" + encodeURIComponent(workspace) + "/" + module;
  const url = new URL(path, base).toString();
  // Validate a genuine signed-in operator response before recording any pixels.
  // Do NOT persist or print the DOM, since it can contain customer data.
  const document = chromium(["--window-size=1440,900", "--dump-dom", url], 45000);
  if (!document.includes('id="app-main-content"') ||
      document.includes("app-auth-entry-link") ||
      document.includes("Staff sign-in required") ||
      document.includes("Workspace unavailable")) {
    throw new Error("Authenticated staff route unavailable at " + module + "; no visual PASS claimed.");
  }
  for (const width of widths) {
    const height = width <= 390 ? 812 : 900;
    const destination = join(out, module + "-" + width + ".png");
    chromium(["--window-size=" + width + "," + height, "--screenshot=" + destination, url], 45000);
    if (!existsSync(destination) || statSync(destination).size < 1000) {
      throw new Error("No usable Chromium screenshot: " + module + "/" + width);
    }
    results.push({ module, width, height, filename: module + "-" + width + ".png" });
  }
}
const metadata = {
  result: "SCREENSHOTS_CAPTURED_NOT_YET_VISUALLY_ACCEPTED",
  sourceSha: expectedSha,
  sourceShaVerification: "OPERATOR_PROVIDED_ONLY_VERIFY_DEPLOYMENT_SEPARATELY",
  testedOrigin: base.origin,
  workspace: "[withheld from log]",
  capturedAt: new Date().toISOString(),
  screenshotCount: results.length,
  captures: results,
  note: "Contains nonproduction authenticated UI; keep evidence out of public repositories.",
};
writeFileSync(join(out, "manifest.json"), JSON.stringify(metadata, null, 2));
console.log("Captured " + results.length + " real Chromium screenshots at five viewports; review visual, overflow, keyboard and source SHA separately.");
