import type { Result } from "../../contracts";
import type { AiModelTransportConfig } from "./model-transport";

export type AiEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * AI is opt-in. A configured key by itself never enables model processing,
 * and an invalid endpoint cannot be promoted into an outbound bearer call.
 */
export function readConfiguredAiRuntimeConfig(
  env: AiEnvironment = process.env,
): Result<AiModelTransportConfig> {
  if (env.SERVICEDESK_AI_ENABLED !== "true") {
    return { ok: false, code: "AI_RUNTIME_DISABLED",
      message: "Operational AI is disabled until explicitly enabled." };
  }
  const provider = env.SERVICEDESK_AI_PROVIDER ?? "openai";
  if (provider !== "openai" && provider !== "codex_gateway") {
    return {ok:false,code:"AI_RUNTIME_PROVIDER_INVALID",message:"Unrecognized AI provider."};
  }
  // A second opt-in switch prevents an existing production AI flag from
  // silently sending customer data to the operator's private Codex gateway.
  if (provider === "codex_gateway" && env.SERVICEDESK_CODEX_GATEWAY_ENABLED !== "true") {
    return {ok:false,code:"AI_RUNTIME_GATEWAY_DISABLED",message:"Private Codex gateway is disabled."};
  }
  const apiKey = (provider === "codex_gateway"
    ? env.SERVICEDESK_CODEX_GATEWAY_KEY : env.OPENAI_API_KEY ?? "").trim();
  const model = (env.SERVICEDESK_AI_MODEL ?? "").trim();
  const apiBaseUrl = (env.SERVICEDESK_AI_API_BASE_URL ??
    (provider === "codex_gateway"
      ? "https://codex-api.ezcomo.shop/v1" : "https://api.openai.com/v1")).trim();
  if (!apiKey || !/^[A-Za-z0-9._:-]{2,100}$/.test(model)) {
    return { ok: false, code: "AI_RUNTIME_CONFIGURATION_INCOMPLETE",
      message: "Operational AI server credentials or model selection are incomplete." };
  }
  // The installed samai gateway advertises these stable aliases; arbitrary
  // model strings and operator-supplied origins are never forwarded.
  const codexModels = new Set([
    "codex", "codex-sol", "codex-balanced", "codex-terra",
    "codex-efficient", "codex-luna", "codex-mini", "codex-5.4-mini",
  ]);
  if (provider === "codex_gateway" && !codexModels.has(model)) {
    return {ok:false,code:"AI_RUNTIME_MODEL_INVALID",
      message:"The private Codex gateway model alias is not approved."};
  }
  let url: URL;
  try { url = new URL(apiBaseUrl); } catch {
    return { ok: false, code: "AI_RUNTIME_ORIGIN_INVALID",
      message: "Operational AI requires the exact authorized HTTPS endpoint." };
  }
  const allowed = provider === "codex_gateway"
    ? ["https://codex-api.ezcomo.shop/v1", "https://codex-api.ezcomo.shop/v1/"]
    : ["https://api.openai.com/v1", "https://api.openai.com/v1/"];
  if (!allowed.includes(url.toString())) {
    return { ok: false, code: "AI_RUNTIME_ORIGIN_INVALID",
      message: "Operational AI requires the exact authorized HTTPS endpoint." };
  }
  // Responses output tokens include both visible text and reasoning.
  // A missing budget gets a finite, useful default; invalid budgets fail closed.
  const outputRaw = env.SERVICEDESK_AI_MAX_OUTPUT_TOKENS;
  const maxOutputTokens = outputRaw === undefined ? 4096 : Number(outputRaw);
  if (!Number.isSafeInteger(maxOutputTokens) ||
      maxOutputTokens < 512 || maxOutputTokens > 8192) {
    return { ok: false, code: "AI_RUNTIME_OUTPUT_BUDGET_INVALID",
      message: "Operational AI output token ceiling is outside the approved range." };
  }
  const timeoutRaw = env.SERVICEDESK_AI_TIMEOUT_MS;
  const parsed = timeoutRaw === undefined ? 10_000 : Number(timeoutRaw);
  if (!Number.isFinite(parsed) || parsed < 250 || parsed > 30_000) {
    return { ok: false, code: "AI_RUNTIME_TIMEOUT_INVALID",
      message: "Operational AI timeout is outside the bounded range." };
  }
  return { ok: true, value: {
    apiBaseUrl: provider === "codex_gateway"
      ? "https://codex-api.ezcomo.shop/v1" : "https://api.openai.com/v1",
    ...(provider === "codex_gateway"
      ? {provider:"codex_gateway" as const,
        approvedGatewayOrigin:"https://codex-api.ezcomo.shop"} : {}),
    apiKey,
    model,
    timeoutMs: parsed,
    maxOutputTokens,
    now: () => new Date().toISOString(),
  } };
}
