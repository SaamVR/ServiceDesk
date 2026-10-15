/** Read-only live Render review smoke: never authenticate, send, or mutate.
 * Run after the manual Render review deployment is LIVE. github.sha must be
 * the review branch merge commit (not the controller's source SHA).
 */
import { writeFileSync } from "node:fs";

const base = "https://servicedesk-v3-frontend-review.onrender.com";
const expected = process.env.GITHUB_SHA;
if (!/^[a-f0-9]{40}$/.test(expected ?? "")) {
  throw new Error("Missing exact checked-out review commit SHA.");
}
const timeout = 15_000;
async function request(path) {
  const response = await fetch(new URL(path, base), {
    method: "GET", redirect: "manual", signal: AbortSignal.timeout(timeout),
    headers: { "user-agent": "ServiceDesk-V4-ReadOnly-Review-Gate" },
  });
  return response;
}

const health = await request("/health");
if (health.status !== 200) throw new Error("LIVE_HEALTH_HTTP_" + health.status);
let state;
try {
  const body = await health.text();
  if (Buffer.byteLength(body, "utf8") > 4096) throw new Error("oversized");
  state = JSON.parse(body);
} catch { throw new Error("LIVE_HEALTH_UNVERIFIED"); }
if (state?.ok !== true || state?.service !== "servicedesk" ||
    state?.status !== "live" || state?.sourceProvider !== "render" ||
    state?.sourceSha !== expected) {
  throw new Error("LIVE_RENDER_SHA_MISMATCH (no deployment claim was accepted)");
}
const rows = [];
for (const path of ["/", "/pricing", "/portal"]) {
  const response = await request(path);
  if (response.status !== 200) throw new Error("PUBLIC_ROUTE_HTTP_" + response.status + "_" + path);
  rows.push({ path, status: 200 });
}
for (const path of ["/app/ctg/quotes", "/app/ctg/automations", "/app/ctg/settings"]) {
  const response = await request(path);
  const location = response.headers.get("location");
  if (response.status !== 307 || !location) {
    throw new Error("GUEST_AUTH_NOT_DENIED_" + response.status + "_" + path);
  }
  let target;
  try { target = new URL(location, base); }
  catch { throw new Error("GUEST_AUTH_REDIRECT_INVALID_" + path); }
  if (target.origin !== base || target.pathname !== "/auth/sign-in" ||
      target.searchParams.get("next") !== path) {
    throw new Error("GUEST_AUTH_REDIRECT_UNSAFE_" + path);
  }
  rows.push({ path, status: 307, target: "/auth/sign-in", next: path });
}
const proof = {
  mode: "READ_ONLY_GUEST",
  checkedOutReviewSha: expected,
  liveHealthSourceSha: state.sourceSha,
  origin: base,
  routes: rows,
  conclusion: "REVIEW_SHA_AND_GUEST_ROUTES_PASS",
  disclaimer: "No authenticated owner, customer, provider delivery or commercial UAT was performed.",
};
if (process.env.RUNNER_TEMP) {
  writeFileSync(process.env.RUNNER_TEMP + "/servicedesk-v4-live-review-gate.json",
    JSON.stringify(proof,null,2)+"\n", { flag: "w" });
}
console.log(JSON.stringify(proof,null,2));
