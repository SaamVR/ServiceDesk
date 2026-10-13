import type { Result } from "../../contracts";
import { resolveStaffActor } from "@/features/operations/operational-product-runtime";
import { callAiModel } from "./model-transport";
import { createFetchAiModelTransport } from "./fetch-transport";
import { readConfiguredAiRuntimeConfig } from "./runtime-config";

type Resolver = typeof resolveStaffActor;
type ConfigReader = typeof readConfiguredAiRuntimeConfig;
type ModelCaller = typeof callAiModel;

export interface AiConnectionTestDependencies {
  resolveActor?: Resolver;
  readConfig?: ConfigReader;
  callModel?: ModelCaller;
}

export interface AiConnectionProof {
  state: "PROVIDER_RESPONDED_TO_CONTROLLED_PROBE";
  model: string;
  checkedAt: string;
  source: "REAL_MODEL_RESPONSE_NOT_A_PROVIDER_DELIVERY";
  durableReceipt: false;
}

function fail(code: string, message: string): Result<never> {
  return { ok: false, code, message };
}

/**
 * Only an active owner may explicitly probe the currently configured model.
 * No customer text or workspace data enters the model request. The resulting
 * text is deliberately discarded, and no tool, workflow or provider send is
 * performed. This is ephemeral connection evidence, never release acceptance.
 */
export async function testAuthorizedAiModelConnection(
  workspaceSlug: string,
  deps: AiConnectionTestDependencies = {},
): Promise<Result<AiConnectionProof>> {
  if (workspaceSlug.length < 3 || workspaceSlug.length > 40 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug)) {
    return fail("AI_DIAGNOSTIC_INPUT_INVALID", "Choose a valid workspace.");
  }

  let result: Awaited<ReturnType<Resolver>>;
  try { result = await (deps.resolveActor ?? resolveStaffActor)(workspaceSlug); }
  catch { return fail("AI_DIAGNOSTIC_AUTH_UNAVAILABLE", "Workspace authorization unavailable."); }
  if (!result.ok) return fail("AI_DIAGNOSTIC_AUTH_REQUIRED", "An active owner session is required.");
  const { workspace, actor } = result.value;
  if (workspace.slug !== workspaceSlug || actor.workspaceId !== workspace.id ||
      actor.role !== "OWNER" || !actor.userId) {
    return fail("AI_DIAGNOSTIC_OWNER_REQUIRED", "Only an authorized workspace owner can test AI.");
  }

  let config: ReturnType<ConfigReader>;
  try { config = (deps.readConfig ?? readConfiguredAiRuntimeConfig)(); }
  catch {
    return fail("AI_DIAGNOSTIC_CONFIGURATION_UNAVAILABLE",
      "Model configuration is unavailable.");
  }
  if (!config.ok) return fail(config.code, "Model configuration is unavailable.");

  const prompt = [
    "This is a synthetic ServiceDesk AI connection probe.",
    "There is no customer record, cleaning request, payment, booking or action.",
    "Return only a JSON object with output as an empty object,",
    "replyDraft as 'ServiceDesk model probe acknowledged',",
    "requestedToolCalls as an empty array, and citations as an empty array.",
  ].join(" ");
  let response: Awaited<ReturnType<ModelCaller>>;
  try {
    // Diagnostic checks do not need the full business-inference token budget.
    // Honor a stricter owner-configured cap, never raise it. This does not
    // establish a daily spending limit or a durable provider receipt.
    const probeConfig = {
      ...config.value,
      maxOutputTokens: Math.min(1536, config.value.maxOutputTokens ?? 4096),
    };
    response = await (deps.callModel ?? callAiModel)(probeConfig, {
      promptVersion: "servicedesk-v4-synthetic-ai-owner-connection-probe",
      conversationId: "synthetic-connection-probe",
      workspaceId: workspace.id,
      userText: prompt,
      approvedKnowledgeRefs: [],
    }, createFetchAiModelTransport());
  } catch {
    // A provider adapter or injected transport can throw after authorization;
    // never leak exception text, tokens, or provider payloads into staff UI.
    return fail("AI_DIAGNOSTIC_PROVIDER_FAILED",
      "Model did not return a valid response.");
  }

  if (!response.ok) {
    return fail("AI_DIAGNOSTIC_PROVIDER_FAILED", "Model did not return a valid response.");
  }
  if (!response.value.output || typeof response.value.output !== "object" ||
      Array.isArray(response.value.output) ||
      Object.keys(response.value.output).length !== 0 ||
      !Array.isArray(response.value.requestedToolCalls) ||
      response.value.requestedToolCalls.length !== 0 ||
      !Array.isArray(response.value.citations) ||
      response.value.citations.length !== 0 ||
      response.value.replyDraft !== "ServiceDesk model probe acknowledged") {
    return fail("AI_DIAGNOSTIC_RESPONSE_UNVERIFIED", "Model returned an unexpected probe result.");
  }
  return { ok: true, value: {
    state: "PROVIDER_RESPONDED_TO_CONTROLLED_PROBE",
    model: config.value.model,
    checkedAt: config.value.now(),
    source: "REAL_MODEL_RESPONSE_NOT_A_PROVIDER_DELIVERY",
    durableReceipt: false,
  } };
}
