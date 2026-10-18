import type { Result } from "../../contracts";
import { resolveStaffActor, type ResolvedStaffActor } from "../../features/operations/operational-product-runtime";
import type { AiPersistedMessageLookup } from "./postgres-conversation-store";
import { createOperationalAiRuntime, type OperationalAiRuntimeDependencies } from "./operational-runtime";
import { ApprovedKnowledgeIndex } from "./knowledge";
import { loadApprovedCatalogKnowledge } from "./catalog-knowledge";
import { readConfiguredAiRuntimeConfig } from "./runtime-config";
import type { AssistantTurn } from "./types";

export interface StaffAiInvocation {
  workspaceSlug: string;
  conversationId: string;
  messageId: string;
}
export interface StaffAiInvocationDependencies {
  resolveActor: (slug: string) => Promise<
    { ok: true; value: ResolvedStaffActor } |
    { ok: false; message: string; kind: string }
  >;
  knowledge?: ApprovedKnowledgeIndex;
  env?: OperationalAiRuntimeDependencies["env"];
  fetchPort?: OperationalAiRuntimeDependencies["fetchPort"];
  promptVersion?: string;
}

function fail(code: string, message: string): Result<never> {
  return { ok: false, code, message };
}

/**
 * An explicit, staff-initiated backend command, never a provider webhook
 * auto-send. The session/membership/branch scope comes from resolveStaffActor
 * (Supabase Auth getUser + active membership + configured branch assignment).
 * Client-provided IDs select a record but cannot grant access to it.
 * The result is a draft and non-executing tool proposal; it does NOT post a
 * customer message, mutate quotes, or approve any provider send.
 */
export async function executeAuthorizedStaffAiTurn(
  input: StaffAiInvocation,
  deps: StaffAiInvocationDependencies,
): Promise<Result<AssistantTurn>> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.workspaceSlug) ||
      !input.conversationId?.trim() || input.conversationId.length > 128 ||
      !input.messageId?.trim() || input.messageId.length > 128) {
    return fail("AI_STAFF_INPUT_INVALID", "An exact workspace, conversation and message are required.");
  }
  let resolved: Awaited<ReturnType<StaffAiInvocationDependencies["resolveActor"]>>;
  try { resolved = await deps.resolveActor(input.workspaceSlug); }
  catch { return fail("AI_STAFF_AUTH_UNAVAILABLE", "Workspace authorization is temporarily unavailable."); }
  if (!resolved.ok) return fail("AI_STAFF_UNAUTHORIZED", "An active authorized staff session is required.");
  const { actor, workspace, service, branchScope } = resolved.value;
  if (workspace.slug !== input.workspaceSlug ||
      actor.workspaceId !== workspace.id || !actor.userId ||
      !["OWNER", "DISPATCHER"].includes(actor.role)) {
    return fail("AI_STAFF_WORKSPACE_MISMATCH", "Staff session does not authorize this workspace.");
  }

  // A dispatcher must have an explicit, verified branch assignment. The
  // request-brief boundary already denies legacy/ALL scopes; AI conversation
  // drafts must not be the exception. Fail before reading messages or calling
  // any model, even if an injected/stale resolver supplies an ALL scope.
  if (actor.role === "DISPATCHER" &&
      (branchScope.mode !== "BRANCH" || !branchScope.selectedBranchId)) {
    return fail("AI_BRANCH_SCOPE_REQUIRED",
      "Select an assigned branch before analyzing customer conversations.");
  }

  // No database or model work is allowed while operational AI is disabled.
  const enabled = readConfiguredAiRuntimeConfig(deps.env);
  if (!enabled.ok) return enabled;

  try {
    const conv = await service.from("conversations")
      .select("id,workspace_id,request_id,customer_id,channel,handover_active")
      .eq("workspace_id", workspace.id)
      .eq("id", input.conversationId)
      .maybeSingle();
    if (conv.error) return fail("AI_CONVERSATION_READ_FAILED", "Conversation could not be verified.");
    const c = conv.data;
    if (!c || c.id !== input.conversationId || c.workspace_id !== workspace.id) {
      return fail("AI_CONVERSATION_NOT_FOUND", "The selected conversation is unavailable.");
    }

    if (actor.role === "DISPATCHER" && branchScope.mode === "BRANCH") {
      // A dispatcher cannot use AI to inspect a different branch's inbox.
      // Unassigned conversations are operator triage until a branch is set.
      if (!branchScope.selectedBranchId || typeof c.request_id !== "string") {
        return fail("AI_BRANCH_SCOPE_REQUIRED", "An assigned request in the active branch is required.");
      }
      const scopedRequest = await service.from("requests")
        .select("id,workspace_id,branch_id")
        .eq("workspace_id", workspace.id)
        .eq("id", c.request_id)
        .maybeSingle();
      if (scopedRequest.error || !scopedRequest.data ||
          scopedRequest.data.workspace_id !== workspace.id ||
          scopedRequest.data.branch_id !== branchScope.selectedBranchId) {
        return fail("AI_BRANCH_SCOPE_REQUIRED", "Conversation is outside the authorized branch.");
      }
    }

    const msg = await service.from("messages")
      .select("id,workspace_id,conversation_id,direction,sender_kind,body,created_at")
      .eq("workspace_id", workspace.id)
      .eq("conversation_id", input.conversationId)
      .eq("id", input.messageId)
      .maybeSingle();
    if (msg.error) return fail("AI_MESSAGE_READ_FAILED", "The saved customer message is unavailable.");
    const m = msg.data;
    if (!m || m.id !== input.messageId || m.workspace_id !== workspace.id ||
        m.conversation_id !== input.conversationId || m.direction !== "INBOUND" ||
        m.sender_kind !== "CUSTOMER" || typeof m.body !== "string" ||
        !m.body.trim() || m.body.length > 8_000 ||
        typeof m.created_at !== "string" || !Number.isFinite(Date.parse(m.created_at))) {
      return fail("AI_MESSAGE_NOT_AUTHORIZED", "The selected saved customer message cannot be analyzed.");
    }

    if (c.channel !== "WHATSAPP" && c.channel !== "EMAIL") {
      return fail("AI_CONVERSATION_CHANNEL_INVALID", "Conversation channel is not supported.");
    }
    // Fetch authoritative, active service knowledge only after membership,
    // branch and customer message checks. Never use fixture FAQs in production.
    const knowledge = deps.knowledge
      ? { ok: true as const, value: deps.knowledge }
      : await loadApprovedCatalogKnowledge(service, workspace.id);
    if (!knowledge.ok) return knowledge;
    const runtime = createOperationalAiRuntime({
      messages: service as unknown as AiPersistedMessageLookup,
      knowledge: knowledge.value,
      env: deps.env,
      fetchPort: deps.fetchPort,
      promptVersion: deps.promptVersion ?? "servicedesk-v3-reviewed-intake",
    });
    if (!runtime.ok) return runtime;
    const generated = await runtime.value.respond(actor, input.conversationId, {
      messageId: m.id,
      channel: c.channel,
      text: m.body,
      receivedAt: m.created_at,
      requestId: typeof c.request_id === "string" ? c.request_id : undefined,
      customerId: typeof c.customer_id === "string" ? c.customer_id : undefined,
      handoverActive: Boolean(c.handover_active),
    });
    if (!generated.ok) return generated;

    // Provider generation can take tens of seconds. Do not release a stale
    // answer after staff revocation, a human handover, moved conversation,
    // changed inbound message, or dispatcher branch reassignment.
    let current: Awaited<ReturnType<StaffAiInvocationDependencies["resolveActor"]>>;
    try { current = await deps.resolveActor(input.workspaceSlug); }
    catch { return fail("AI_STAFF_REVALIDATION_UNAVAILABLE", "Staff access could not be rechecked."); }
    if (!current.ok || current.value.workspace.id !== workspace.id ||
        current.value.workspace.slug !== input.workspaceSlug ||
        current.value.actor.workspaceId !== workspace.id ||
        current.value.actor.userId !== actor.userId ||
        current.value.actor.role !== actor.role ||
        !["OWNER","DISPATCHER"].includes(current.value.actor.role)) {
      return fail("AI_STAFF_ACCESS_REVOKED", "Staff access changed while generating the AI draft.");
    }
    const nowScope = current.value.branchScope;
    if (actor.role === "DISPATCHER" &&
        (nowScope.mode !== "BRANCH" ||
         nowScope.selectedBranchId !== branchScope.selectedBranchId ||
         !nowScope.selectedBranchId)) {
      return fail("AI_STAFF_ACCESS_REVOKED", "Dispatcher branch access changed during AI generation.");
    }
    const currentService = current.value.service;
    const convNow = await currentService.from("conversations")
      .select("id,workspace_id,request_id,customer_id,channel,handover_active")
      .eq("workspace_id",workspace.id).eq("id",input.conversationId).maybeSingle();
    const cn = convNow.data;
    if (convNow.error || !cn || cn.id !== c.id ||
        cn.workspace_id !== workspace.id ||
        cn.request_id !== c.request_id || cn.customer_id !== c.customer_id ||
        cn.channel !== c.channel || cn.handover_active !== c.handover_active) {
      return fail("AI_STAFF_SOURCE_CHANGED", "The saved conversation changed while generating the AI draft.");
    }
    if (actor.role === "DISPATCHER") {
      if (typeof cn.request_id !== "string") {
        return fail("AI_STAFF_ACCESS_REVOKED", "No branch-authorized request remains.");
      }
      const linked = await currentService.from("requests")
        .select("id,workspace_id,branch_id")
        .eq("workspace_id",workspace.id).eq("id",cn.request_id).maybeSingle();
      if (linked.error || !linked.data ||
          linked.data.workspace_id !== workspace.id ||
          linked.data.branch_id !== nowScope.selectedBranchId) {
        return fail("AI_STAFF_ACCESS_REVOKED", "Linked request no longer belongs to the assigned branch.");
      }
    }
    const msgNow = await currentService.from("messages")
      .select("id,workspace_id,conversation_id,direction,sender_kind,body,created_at")
      .eq("workspace_id",workspace.id)
      .eq("conversation_id",input.conversationId)
      .eq("id",input.messageId).maybeSingle();
    const mn=msgNow.data;
    if (msgNow.error || !mn || mn.id !== m.id ||
        mn.workspace_id !== workspace.id ||
        mn.conversation_id !== m.conversation_id ||
        mn.direction !== m.direction || mn.sender_kind !== m.sender_kind ||
        mn.body !== m.body || mn.created_at !== m.created_at) {
      return fail("AI_STAFF_SOURCE_CHANGED", "The saved customer message changed during AI generation.");
    }
    return generated;
  } catch {
    return fail("AI_STAFF_READ_UNAVAILABLE", "Workspace conversation read is temporarily unavailable.");
  }
}

/** Real Next server boundary: resolveStaffActor verifies cookie-backed Supabase
 * identity and active workspace + branch membership before any privileged read.
 * An app route/server action can call this function without accepting an actor
 * role or workspace ID from client input.
 */
export async function runOperationalStaffAiTurn(input: StaffAiInvocation): Promise<Result<AssistantTurn>> {
  return executeAuthorizedStaffAiTurn(input, { resolveActor: resolveStaffActor });
}
