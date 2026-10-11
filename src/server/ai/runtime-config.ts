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
  const apiKey = (env.OPENAI_API_KEY ?? "").trim();
  const model = (env.SERVICEDESK_AI_MODEL ?? "").trim();
  const apiBaseUrl = (env.SERVICEDESK_AI_API_BASE_URL ?? "https://api.openai.com/v1").trim();
  if (!apiKey || !/^[A-Za-z0-9._:-]{2,100}$/.test(model)) {
    return { ok: false, code: "AI_RUNTIME_CONFIGURATION_INCOMPLETE",
      message: "Operational AI server credentials or model selection are incomplete." };
  }
  let url: URL;
  try { url = new URL(apiBaseUrl); } catch {
    return { ok: false, code: "AI_RUNTIME_ORIGIN_INVALID",
      message: "Operational AI requires the exact authorized HTTPS endpoint." };
  }
  if (url.toString() !== "https://api.openai.com/v1" && url.toString() !== "https://api.openai.com/v1/") {
    return { ok: false, code: "AI_RUNTIME_ORIGIN_INVALID",
      message: "Operational AI requires the exact authorized HTTPS endpoint." };
  }
  const timeoutRaw = env.SERVICEDESK_AI_TIMEOUT_MS;
  const parsed = timeoutRaw === undefined ? 10_000 : Number(timeoutRaw);
  if (!Number.isFinite(parsed) || parsed < 250 || parsed > 30_000) {
    return { ok: false, code: "AI_RUNTIME_TIMEOUT_INVALID",
      message: "Operational AI timeout is outside the bounded range." };
  }
  return { ok: true, value: {
    apiBaseUrl: "https://api.openai.com/v1",
    apiKey,
    model,
    timeoutMs: parsed,
    now: () => new Date().toISOString(),
  } };
}
