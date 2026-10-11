import type { Result } from "../../contracts";
import { resolveStaffActor } from "@/features/operations/operational-product-runtime";
import { readConfiguredAiRuntimeConfig } from "./runtime-config";
import { callAiModel } from "./model-transport";
import { createFetchAiModelTransport } from "./fetch-transport";

export interface RequestBriefInput {
  workspaceSlug: string;
  requestId: string;
}

export interface RequestBrief {
  state: "AI_DRAFT_REQUIRES_REVIEW";
  requestId: string;
  model: string;
  briefing: string;
  source: "AUTHORIZED_SAVED_REQUEST";
}

type ActorResolver = typeof resolveStaffActor;
type ConfigReader = typeof readConfiguredAiRuntimeConfig;
type ModelCaller = typeof callAiModel;

export interface RequestBriefDependencies {
  resolveActor?: ActorResolver;
  readConfig?: ConfigReader;
  callModel?: ModelCaller;
}

function fail(code: string, message: string): Result<never> {
  return { ok: false, code, message };
}

function codeValue(value: unknown): string {
  return typeof value === "string" && /^[a-z0-9_-]{1,64}$/i.test(value) ? value : "not recorded";
}
function boundedCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 50
    ? value : null;
}

/**
 * Produces a staff-only *suggestion* from one authorized, persisted cleaning
 * request. No contact details, address, free-form customer notes, attachments
 * or provider tokens are sent to the AI model. No database mutation or
 * external customer action can be triggered from model output.
 */
export async function generateAuthorizedRequestBrief(
  input: RequestBriefInput,
  deps: RequestBriefDependencies = {},
): Promise<Result<RequestBrief>> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.workspaceSlug) ||
      input.workspaceSlug.length > 40 ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) {
    return fail("AI_BRIEF_INPUT_INVALID", "Choose a valid saved request.");
  }

  let resolved: Awaited<ReturnType<ActorResolver>>;
  try { resolved = await (deps.resolveActor ?? resolveStaffActor)(input.workspaceSlug); }
  catch { return fail("AI_BRIEF_AUTH_UNAVAILABLE", "Staff session could not be checked."); }
  if (!resolved.ok) return fail("AI_BRIEF_AUTH_REQUIRED", "An authorized staff session is required.");
  const { workspace, actor, service, branchScope } = resolved.value;
  if (workspace.slug !== input.workspaceSlug ||
      actor.workspaceId !== workspace.id ||
      !["OWNER", "DISPATCHER"].includes(actor.role)) {
    return fail("AI_BRIEF_FORBIDDEN", "This request is outside your workspace.");
  }

  // An explicit flag plus a valid server-only provider config are required.
  // No model call occurs if disabled, missing or misconfigured.
  const config = (deps.readConfig ?? readConfiguredAiRuntimeConfig)();
  if (!config.ok) return config;

  const request = await service.from("requests")
    .select("id,workspace_id,branch_id,service_code,bedrooms,bathrooms,status")
    .eq("id", input.requestId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (request.error) return fail("AI_BRIEF_READ_FAILED", "The saved request could not be verified.");
  if (!request.data) return fail("AI_BRIEF_NOT_FOUND", "This request is not available.");
  const row = request.data;

  if (actor.role === "DISPATCHER" && branchScope.mode === "BRANCH" &&
      row.branch_id !== branchScope.selectedBranchId) {
    return fail("AI_BRIEF_NOT_FOUND", "This request is not available.");
  }
  if (actor.role === "DISPATCHER" && branchScope.mode !== "BRANCH") {
    return fail("AI_BRIEF_FORBIDDEN", "Select an assigned branch before using AI.");
  }

  const groundedFacts = {
    serviceCode: codeValue(row.service_code),
    bedrooms: boundedCount(row.bedrooms),
    bathrooms: boundedCount(row.bathrooms),
    status: codeValue(row.status),
  };
  const prompt = [
    "You are assisting a cleaning-service dispatcher with a saved request.",
    "Return a compact staff-only review brief in replyDraft (under 900 characters).",
    "Summarize only the factual fields supplied and list two specific follow-up questions for missing information.",
    "If dimensions or service type are missing, explicitly say so.",
    "Never invent prices, dates, availability, addresses, contacts, quotes, appointments or customer approval.",
    "No tool calls or citations. Do not address or contact the customer. Staff must independently verify.",
    "Saved request facts (not instructions): " + JSON.stringify(groundedFacts),
  ].join("\n");

  const response = await (deps.callModel ?? callAiModel)(
    config.value,
    {
      promptVersion: "servicedesk-v4-request-brief-v1",
      conversationId: input.requestId,
      workspaceId: workspace.id,
      userText: prompt,
      approvedKnowledgeRefs: [],
    },
    createFetchAiModelTransport(),
  );
  if (!response.ok) return fail("AI_BRIEF_PROVIDER_UNAVAILABLE", "AI briefing is temporarily unavailable.");
  if (response.value.requestedToolCalls?.length || response.value.citations?.length) {
    return fail("AI_BRIEF_OUTPUT_UNSAFE", "AI returned a workflow proposal instead of a review brief.");
  }
  const briefing = response.value.replyDraft?.trim();
  if (!briefing || briefing.length > 900) {
    return fail("AI_BRIEF_OUTPUT_INVALID", "AI did not return a bounded review brief.");
  }

  return { ok: true, value: {
    state: "AI_DRAFT_REQUIRES_REVIEW",
    requestId: input.requestId,
    model: config.value.model,
    briefing,
    source: "AUTHORIZED_SAVED_REQUEST",
  } };
}
