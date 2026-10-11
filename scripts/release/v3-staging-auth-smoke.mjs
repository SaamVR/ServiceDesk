#!/usr/bin/env node
/**
 * ServiceDesk isolated V3 public-auth smoke check.
 * Read-only: never submits forms, creates users, sends mail or touches data.
 *
 * Usage: node scripts/release/v3-staging-auth-smoke.mjs [https://preview.example]
 * Environment:
 *   SERVICEDESK_PREVIEW_URL (alternative base URL)
 *   SERVICEDESK_SMOKE_STRICT_AVAILABILITY=1 (treat any 503 as a failure)
 *
 * Reports cold-start 503 separately from application logic failures.
 * No credentials, response bodies, cookies or personal data are printed.
 */
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const DEFAULT_PREVIEW = "https://servicedesk-v2-multilane-gate.onrender.com";
export const PATHS = Object.freeze([
  { key: "signup-disabled", path: "/auth/sign-up", phrase: "Account registration is not available on this preview yet." },
  { key: "check-email-disabled", path: "/auth/sign-up/check-email", phrase: "New registration and verification messages are not enabled on this preview yet." },
  { key: "workspace-disabled", path: "/auth/create-workspace", phrase: "Workspace registration is not enabled on this preview." },
  { key: "password-recovery", path: "/auth/forgot-password", phrase: "Send reset link" },
  { key: "signed-out-continuation", path: "/auth/continue?next=https%3A%2F%2Fexample.invalid", redirect: "/auth/sign-in" },
]);

export function validatedPreviewUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    // Avoid silently running smoke against an arbitrary production or internal host.
    if (url.hostname !== "servicedesk-v2-multilane-gate.onrender.com" &&
        !url.hostname.endsWith(".onrender.com")) return null;
    return url.origin;
  } catch { return null; }
}

export function safePublicRedirect(base, rawLocation, expectedPath) {
  if (!rawLocation) return false;
  try {
    const destination = new URL(rawLocation, base);
    return destination.origin === base &&
      destination.pathname === expectedPath &&
      !destination.username && !destination.password;
  } catch { return false; }
}

export function assessSmokeResult(base, spec, response) {
  if (response.status === 503) return { key: spec.key, status: "COLD_START_503", http: 503 };
  if (spec.redirect) {
    return {
      key: spec.key,
      status: response.status === 303 &&
        safePublicRedirect(base, response.location, spec.redirect) ? "PASS" : "FAIL",
      http: response.status,
    };
  }
  return {
    key: spec.key,
    status: response.status === 200 && response.body.includes(spec.phrase) ? "PASS" : "FAIL",
    http: response.status,
  };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchOne(base, spec) {
  const response = await fetch(base + spec.path, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(25_000),
    headers: { "accept": "text/html", "cache-control": "no-cache" },
  });
  return {
    status: response.status,
    location: response.headers.get("location"),
    // Read only public HTML; never return or print body text.
    body: spec.redirect ? "" : await response.text(),
  };
}

export async function runSmoke(base, { strictAvailability = false, attempts = 4, delayMs = 8_000 } = {}) {
  const observations = [];
  let sawColdStart = false;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const results = await Promise.all(PATHS.map(async spec => {
      try {
        return assessSmokeResult(base, spec, await fetchOne(base, spec));
      } catch {
        return { key: spec.key, status: "NETWORK_FAILURE", http: null };
      }
    }));
    if (results.some(result => result.status === "COLD_START_503")) sawColdStart = true;
    observations.push({ attempt, results });
    if (results.every(result => result.status === "PASS")) {
      return {
        result: sawColdStart && strictAvailability ? "FAIL_AVAILABILITY" : "PASS",
        coldStart503Observed: sawColdStart,
        attempts: attempt,
        checks: results,
      };
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  const latest = observations.at(-1)?.results ?? [];
  return {
    result: "FAIL",
    coldStart503Observed: sawColdStart,
    attempts,
    checks: latest,
  };
}

async function main() {
  const base = validatedPreviewUrl(process.argv[2] || process.env.SERVICEDESK_PREVIEW_URL || DEFAULT_PREVIEW);
  if (!base) {
    process.stderr.write(JSON.stringify({ result: "FAIL", reason: "Invalid or non-staging preview origin" }) + "\n");
    process.exitCode = 2;
    return;
  }
  const strictAvailability = process.env.SERVICEDESK_SMOKE_STRICT_AVAILABILITY === "1";
  const result = await runSmoke(base, { strictAvailability });
  process.stdout.write(JSON.stringify({ preview: base, ...result }, null, 2) + "\n");
  if (result.result !== "PASS") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
