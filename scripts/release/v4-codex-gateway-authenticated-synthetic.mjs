#!/usr/bin/env node
/**
 * R25: one explicitly operator-authorized synthetic public Codex HTTP POST.
 * Never reads customer records, triggers tools, or prints bearer/payload data.
 * The direct gateway POST is not an authenticated ServiceDesk owner journey.
 */
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const ENDPOINT = "https://codex-api.ezcomo.shop/v1/chat/completions";
const EXPECTED_REPLY = "ServiceDesk model probe acknowledged";
const MAX_BYTES = 64 * 1024;
const TIMEOUT_MS = 35_000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function report(state, detail = "") {
  return {
    kind: "ONE_SHOT_PUBLIC_GATEWAY_SYNTHETIC_PROBE",
    state,
    detail,
    providerVerified: state === "PROVIDER_VERIFIED_PUBLIC_SYNTHETIC_ONLY",
    serviceDeskOwnerJourneyVerified: false,
    businessMutations: 0,
    providerMessagesSentToCustomers: 0,
  };
}
export function validateProbeConfig(config) {
  if (config?.acknowledgement !== "I_AUTHORIZE_ONE_SYNTHETIC_CODEX_PROBE" ||
      !UUID.test(config.workspaceId ?? "") ||
      !UUID.test(config.allowedWorkspaceId ?? "") ||
      config.workspaceId !== config.allowedWorkspaceId) {
    return "OPERATOR_AUTHORIZATION_REQUIRED";
  }
  if (typeof config.bearer !== "string" || config.bearer.length < 12 ||
      config.bearer.length > 512 || !/^[\x21-\x7e]+$/.test(config.bearer)) {
    return "EVALUATION_GATEWAY_SECRET_MISSING";
  }
  return null;
}
export function validateStructuredProbeCompletion(envelope) {
  if (!envelope || envelope.object !== "chat.completion" ||
      !Array.isArray(envelope.choices) || envelope.choices.length !== 1) return false;
  const choice = envelope.choices[0];
  const msg = choice?.message;
  if (choice?.index !== 0 || choice?.finish_reason !== "stop" ||
      msg?.role !== "assistant" || typeof msg.content !== "string" ||
      Object.hasOwn(msg,"tool_calls") || Object.hasOwn(msg,"function_call") ||
      Object.hasOwn(msg,"refusal")) return false;
  let output;
  try { output = JSON.parse(msg.content); } catch { return false; }
  if (!output || typeof output !== "object" || Array.isArray(output) ||
      Object.keys(output).sort().join(",") !== "citations,output,replyDraft,requestedToolCalls" ||
      !output.output || typeof output.output !== "object" ||
      Array.isArray(output.output) || Object.keys(output.output).length !== 0 ||
      output.replyDraft !== EXPECTED_REPLY ||
      !Array.isArray(output.requestedToolCalls) || output.requestedToolCalls.length !== 0 ||
      !Array.isArray(output.citations) || output.citations.length !== 0) return false;
  return true;
}
export async function executeSyntheticGatewayProbe(config, fetchPort = fetch) {
  const invalid = validateProbeConfig(config);
  if (invalid) return report("CONFIGURATION_BLOCKED", invalid);

  const body = JSON.stringify({
    model: "codex", stream: false, reasoning_effort: "low", workspace: "servicedesk-ai",
    messages: [
      { role: "system", content:
        "Synthetic ServiceDesk connectivity test only. No business records, tools, citations, data extraction or sends. Return a single JSON object." },
      { role: "user", content:
        'Reply ONLY with this exact JSON, no code fences: {"output":{},"replyDraft":"ServiceDesk model probe acknowledged","requestedToolCalls":[],"citations":[]}' },
    ],
  });
  let response;
  try {
    response = await fetchPort(ENDPOINT, {
      method: "POST", redirect: "error", cache: "no-store",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + config.bearer,
        "accept": "application/json",
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return report("PROVIDER_UNVERIFIED", "HTTP_NETWORK_OR_TIMEOUT_FAILURE");
  }

  if (response.status !== 200) {
    await response.body?.cancel().catch(() => {});
    if (response.status === 401 || response.status === 403)
      return report("PROVIDER_UNVERIFIED", "AUTH_OR_EDGE_REJECTED");
    if (response.status === 429) return report("PROVIDER_UNVERIFIED", "RATE_LIMITED");
    return report("PROVIDER_UNVERIFIED", "HTTP_STATUS_" + String(response.status));
  }
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    await response.body?.cancel().catch(() => {});
    return report("PROVIDER_UNVERIFIED", "UNEXPECTED_CONTENT_TYPE");
  }
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BYTES) {
    await response.body?.cancel().catch(() => {});
    return report("PROVIDER_UNVERIFIED", "RESPONSE_TOO_LARGE");
  }
  let bytes = 0, raw = "";
  try {
    if (!response.body) return report("PROVIDER_UNVERIFIED", "EMPTY_RESPONSE");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_BYTES) {
          await reader.cancel();
          return report("PROVIDER_UNVERIFIED", "RESPONSE_TOO_LARGE");
        }
        raw += decoder.decode(chunk.value, {stream:true});
      }
      raw += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  } catch {
    return report("PROVIDER_UNVERIFIED", "RESPONSE_READ_FAILED");
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return report("PROVIDER_UNVERIFIED", "INVALID_JSON_ENVELOPE"); }
  return validateStructuredProbeCompletion(parsed)
    ? report("PROVIDER_VERIFIED_PUBLIC_SYNTHETIC_ONLY", "EXACT_STRUCTURED_NO_TOOL_COMPLETION")
    : report("PROVIDER_UNVERIFIED", "STRUCTURED_COMPLETION_REJECTED");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const env = process.env;
  const result = await executeSyntheticGatewayProbe({
    acknowledgement: env.SERVICEDESK_CODEX_EVAL_ACK,
    workspaceId: env.SERVICEDESK_CODEX_EVAL_WORKSPACE_ID,
    allowedWorkspaceId: env.SERVICEDESK_CODEX_EVAL_ALLOWED_WORKSPACE_ID,
    bearer: env.SERVICEDESK_CODEX_EVAL_GATEWAY_KEY,
  });
  // Deliberately omit key, workspace ID, provider text and HTTP request body.
  console.log(JSON.stringify(result));
  if (env.GITHUB_STEP_SUMMARY) {
    const {appendFile} = await import("node:fs/promises");
    await appendFile(env.GITHUB_STEP_SUMMARY,
      "## Synthetic Codex public POST (one authorized run)\n\n" +
      "**" + result.state + "** — " + result.detail + ".\n\n" +
      "No customer data, app-owner session, dispatch or durable business receipt was tested.\n");
  }
  if (!result.providerVerified) process.exitCode = 1;
}
