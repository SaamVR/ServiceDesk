#!/usr/bin/env node
/**
 * ServiceDesk V4 staging boundary proof.
 *
 * This probe uses ONLY the publishable (anon) key and an intentionally invalid,
 * empty payload. No owner session, service-role credential, business identifier,
 * customer information, provider send or commercial price is supplied.
 *
 * Expected for the staging project's protected RPC: HTTP 401, SQLSTATE 42501.
 * Do not log credentials or the raw API response.
 */
const key = process.env.SERVICEDESK_QA_SUPABASE_PUBLISHABLE_KEY?.trim();
const projectRef = process.env.SERVICEDESK_QA_SUPABASE_PROJECT_REF?.trim();

if (!key || !/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key)) {
  console.error("QA_PRICING_ANON_PREFLIGHT_BLOCKED:VALID_PUBLISHABLE_KEY_REQUIRED");
  process.exit(1);
}
if (projectRef !== "cpmmgivhlkfbiwzhlcey") {
  console.error("QA_PRICING_ANON_PREFLIGHT_BLOCKED:STAGING_PROJECT_MISMATCH");
  process.exit(1);
}

const endpoint = `https://${projectRef}.supabase.co/rest/v1/rpc/servicedesk_setup_owner_cleaning_pricing`;
let response;
try {
  response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ p_input: {} }),
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
} catch {
  console.error("QA_PRICING_ANON_PROBE_UNAVAILABLE");
  process.exit(1);
}

let code = null;
try {
  const body = await response.json();
  code = typeof body?.code === "string" ? body.code : null;
} catch {
  console.error("QA_PRICING_ANON_RESPONSE_NOT_JSON");
  process.exit(1);
}

if (response.status !== 401 || code !== "42501") {
  // Never emit the response body: it may include server or tenant details.
  console.error(`QA_PRICING_ANON_DENIAL_UNVERIFIED:HTTP_${response.status}`);
  process.exit(1);
}
console.log("QA_PRICING_ANON_DENIED:HTTP_401_SQLSTATE_42501");
