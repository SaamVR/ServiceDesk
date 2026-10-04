import type { Result } from "../../contracts";
import type { CleaningRequestExtraction } from "./types";

export interface AiModelTransportConfig {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  now: () => string;
}

export interface AiModelCallInput {
  promptVersion: string;
  conversationId: string;
  workspaceId: string;
  userText: string;
  approvedKnowledgeRefs?: string[];
}

export interface AiModelHttpRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}

export interface AiModelHttpResponse {
  status: number;
  body: string;
}

export type AiModelHttpTransport = (request: AiModelHttpRequest) => Promise<AiModelHttpResponse>;

export interface AiModelOutput {
  output: Partial<CleaningRequestExtraction>;
  replyDraft?: string;
  requestedToolCalls?: Array<{ name: string; arguments?: Record<string, unknown> }>;
  citations?: Array<{ documentId: string; title: string; version: number; chunkId: string }>;
}

export interface RedactedAiModelRequestSummary {
  method: "POST";
  host: string;
  endpoint: string;
  hasBearerAuthorization: boolean;
  bodyKeys: string[];
}

function baseUrl(config: AiModelTransportConfig): string {
  return config.apiBaseUrl.replace(/\/+$/, "");
}

function normalizedFailure(status: number): Result<never> {
  if (status === 401 || status === 403) return { ok: false, code: "AI_MODEL_CONFIGURATION_BLOCKED", message: "AI model provider authentication or authorization failed." };
  if (status === 400) return { ok: false, code: "AI_MODEL_INVALID_REQUEST", message: "AI model provider rejected the request." };
  if (status === 408) return { ok: false, code: "AI_MODEL_TIMEOUT", message: "AI model provider timed out." };
  if (status === 429) return { ok: false, code: "AI_MODEL_RATE_LIMITED", message: "AI model provider rate limit reached." };
  if (status >= 500) return { ok: false, code: "AI_MODEL_TRANSIENT_FAILURE", message: "AI model provider returned a transient server failure." };
  return { ok: false, code: "AI_MODEL_PROVIDER_REJECTED", message: "AI model provider rejected the request." };
}

function buildModelBody(config: AiModelTransportConfig, input: AiModelCallInput): string {
  return JSON.stringify({
    model: config.model,
    response_format: { type: "json_object" },
    metadata: {
      promptVersion: input.promptVersion,
      conversationId: input.conversationId,
      workspaceId: input.workspaceId,
      approvedKnowledgeRefs: input.approvedKnowledgeRefs ?? [],
    },
    input: [
      { role: "system", content: "Return only structured ServiceDesk AI JSON. Never decide prices, payments, roles, or availability." },
      { role: "user", content: input.userText },
    ],
  });
}

function parseModelOutput(body: string): Result<AiModelOutput> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, code: "AI_MODEL_INVALID_RESPONSE", message: "AI model provider returned malformed JSON." };
  }

  const output = (parsed as { output?: unknown }).output;
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return { ok: false, code: "AI_MODEL_INVALID_RESPONSE", message: "AI model provider response is missing structured output." };
  }

  const requestedToolCalls = (parsed as { requestedToolCalls?: unknown }).requestedToolCalls;
  if (requestedToolCalls !== undefined && !Array.isArray(requestedToolCalls)) {
    return { ok: false, code: "AI_MODEL_INVALID_RESPONSE", message: "AI model provider response has invalid tool call shape." };
  }

  const citations = (parsed as { citations?: unknown }).citations;
  if (citations !== undefined && !Array.isArray(citations)) {
    return { ok: false, code: "AI_MODEL_INVALID_RESPONSE", message: "AI model provider response has invalid citation shape." };
  }

  return {
    ok: true,
    value: {
      output: output as Partial<CleaningRequestExtraction>,
      replyDraft: typeof (parsed as { replyDraft?: unknown }).replyDraft === "string" ? (parsed as { replyDraft: string }).replyDraft : undefined,
      requestedToolCalls: requestedToolCalls as AiModelOutput["requestedToolCalls"],
      citations: citations as AiModelOutput["citations"],
    },
  };
}

export function redactedAiModelRequestSummary(request: AiModelHttpRequest): RedactedAiModelRequestSummary {
  const url = new URL(request.url);
  let bodyKeys: string[] = [];
  try {
    bodyKeys = Object.keys(JSON.parse(request.body) as Record<string, unknown>).sort();
  } catch {
    bodyKeys = ["unparseable-json-body"];
  }
  return {
    method: request.method,
    host: url.host,
    endpoint: url.pathname,
    hasBearerAuthorization: request.headers.authorization?.startsWith("Bearer ") === true,
    bodyKeys,
  };
}

export async function callAiModel(
  config: AiModelTransportConfig,
  input: AiModelCallInput,
  http: AiModelHttpTransport,
): Promise<Result<AiModelOutput>> {
  if (!config.apiBaseUrl || !config.apiKey || !config.model) {
    return { ok: false, code: "AI_MODEL_CONFIGURATION_BLOCKED", message: "AI model provider configuration is incomplete." };
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(250, Math.min(config.timeoutMs ?? 10_000, 30_000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await http({
      url: `${baseUrl(config)}/responses`,
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: buildModelBody(config, input),
      signal: controller.signal,
    });

    if (response.status < 200 || response.status >= 300) return normalizedFailure(response.status);
    return parseModelOutput(response.body);
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      return { ok: false, code: "AI_MODEL_TIMEOUT", message: "AI model provider request timed out." };
    }
    return { ok: false, code: "AI_MODEL_NETWORK_FAILURE", message: "AI model provider request failed before a valid response was received." };
  } finally {
    clearTimeout(timeout);
  }
}
