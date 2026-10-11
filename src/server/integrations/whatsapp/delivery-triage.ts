import type { Result } from "../../../contracts";
import { resolveStaffActor, type ResolvedStaffActor } from "../../../features/operations/operational-product-runtime";

export type DeliveryHealth = "OK" | "PENDING" | "NEEDS_REVIEW";
export type DeliveryState =
  "QUEUED" | "RUNNING" | "PROVIDER_ACCEPTED" | "DELIVERED" | "READ" | "FAILED" | "SUPPRESSED";
export interface DeliveryTriageItem {
  messageId: string;
  conversationId: string;
  channel: "WHATSAPP" | "EMAIL";
  deliveryState: DeliveryState;
  createdAt: string;
  ageMinutes: number;
  health: DeliveryHealth;
  reason?: "PROVIDER_FAILURE" | "SUPPRESSED_BY_POLICY" | "STALE_PENDING";
}
export interface DeliveryTriageSnapshot {
  workspaceId: string;
  generatedAt: string;
  truncated: boolean;
  scannedOutboundMessages: number;
  counts: { ok: number; pending: number; review: number };
  items: DeliveryTriageItem[];
}
export interface DeliveryTriageDependencies {
  resolveActor: (workspaceSlug: string) => Promise<
    { ok: true; value: ResolvedStaffActor } | { ok: false; kind: string; message: string }
  >;
  now?: () => Date;
}
const states = new Set<string>([
  "QUEUED", "RUNNING", "PROVIDER_ACCEPTED", "DELIVERED", "READ", "FAILED", "SUPPRESSED",
]);
const validId = (s: unknown): s is string =>
  typeof s === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(s);
const fail = (code: string, message: string): Result<never> => ({ ok: false, code, message });

/**
 * Bounded operational delivery observability from real persisted message rows.
 * No message body, phone number, email, provider secret, raw event or
 * customer identity is returned. This never mutates delivery status or retries
 * outbox dispatch, and it never claims provider delivery without a receipt.
 */
export async function readOperationalDeliveryTriage(
  workspaceSlug: string,
  deps: DeliveryTriageDependencies,
): Promise<Result<DeliveryTriageSnapshot>> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug)) {
    return fail("DELIVERY_TRIAGE_WORKSPACE_INVALID", "Workspace slug is invalid.");
  }
  let staff: Awaited<ReturnType<DeliveryTriageDependencies["resolveActor"]>>;
  try { staff = await deps.resolveActor(workspaceSlug); }
  catch { return fail("DELIVERY_TRIAGE_AUTH_UNAVAILABLE", "Staff access is temporarily unavailable."); }
  if (!staff.ok) return fail("DELIVERY_TRIAGE_UNAUTHORIZED", "An authenticated workspace staff member is required.");
  const { actor, workspace, service, branchScope } = staff.value;
  if (!actor.userId || actor.workspaceId !== workspace.id || workspace.slug !== workspaceSlug ||
      (actor.role !== "OWNER" && actor.role !== "DISPATCHER")) {
    return fail("DELIVERY_TRIAGE_UNAUTHORIZED", "Staff access does not authorize this workspace.");
  }
  if (branchScope.mode === "BRANCH" && !validId(branchScope.selectedBranchId)) {
    return fail("DELIVERY_TRIAGE_BRANCH_UNAVAILABLE", "The selected branch is not authorized.");
  }
  const now = (deps.now ?? (() => new Date()))();
  if (!Number.isFinite(now.getTime())) {
    return fail("DELIVERY_TRIAGE_CLOCK_INVALID", "The reporting clock is invalid.");
  }

  try {
    const outbound = await service.from("messages")
      .select("id,workspace_id,conversation_id,direction,delivery_state,created_at")
      .eq("workspace_id", workspace.id)
      .eq("direction", "OUTBOUND")
      .order("created_at", { ascending: false })
      .limit(201);
    if (outbound.error || !Array.isArray(outbound.data)) {
      return fail("DELIVERY_TRIAGE_MESSAGES_UNAVAILABLE", "Delivery records are unavailable.");
    }
    const scanned = outbound.data.length > 200 ? outbound.data.slice(0, 200) : outbound.data;
    if (scanned.length === 0) {
      return { ok: true, value: {
        workspaceId: workspace.id, generatedAt: now.toISOString(), truncated: false,
        scannedOutboundMessages: 0, counts: { ok: 0, pending: 0, review: 0 }, items: [],
      } };
    }
    for (const row of scanned) {
      if (row.workspace_id !== workspace.id || !validId(row.id) ||
          !validId(row.conversation_id) || row.direction !== "OUTBOUND" ||
          !states.has(row.delivery_state) ||
          typeof row.created_at !== "string" ||
          !Number.isFinite(Date.parse(row.created_at))) {
        return fail("DELIVERY_TRIAGE_MESSAGE_SCOPE_INVALID", "Persisted delivery row did not match this workspace.");
      }
    }
    const conversationIds = [...new Set(scanned.map(m => String(m.conversation_id)))];
    const linked = await service.from("conversations")
      .select("id,workspace_id,channel,request_id")
      .eq("workspace_id", workspace.id)
      .in("id", conversationIds)
      .limit(201);
    if (linked.error || !Array.isArray(linked.data)) {
      return fail("DELIVERY_TRIAGE_CONVERSATIONS_UNAVAILABLE", "Conversation channel scope could not be verified.");
    }
    const conversations = new Map<string, { channel: "EMAIL" | "WHATSAPP"; requestId?: string }>();
    for (const row of linked.data) {
      if (!validId(row.id) || row.workspace_id !== workspace.id ||
          (row.channel !== "EMAIL" && row.channel !== "WHATSAPP") ||
          conversations.has(row.id)) {
        return fail("DELIVERY_TRIAGE_CONVERSATION_INVALID", "Conversation scope was malformed or ambiguous.");
      }
      conversations.set(row.id, {
        channel: row.channel,
        requestId: typeof row.request_id === "string" ? row.request_id : undefined,
      });
    }
    if (scanned.some(row => !conversations.has(row.conversation_id))) {
      return fail("DELIVERY_TRIAGE_CONVERSATION_MISSING", "Outbound message has no authorized conversation.");
    }

    let permittedRequestIds: Set<string> | undefined;
    if (branchScope.mode === "BRANCH") {
      const requestIds = [...new Set([...conversations.values()]
        .map(c => c.requestId).filter((id): id is string => !!id))];
      const requests = requestIds.length
        ? await service.from("requests")
          .select("id,workspace_id,branch_id")
          .eq("workspace_id", workspace.id)
          .in("id", requestIds)
          .limit(201)
        : { data: [], error: null };
      if (requests.error || !Array.isArray(requests.data)) {
        return fail("DELIVERY_TRIAGE_BRANCH_READ_FAILED", "Branch assignment could not be verified.");
      }
      permittedRequestIds = new Set<string>();
      for (const row of requests.data) {
        if (!validId(row.id) || row.workspace_id !== workspace.id) {
          return fail("DELIVERY_TRIAGE_BRANCH_MISMATCH", "Branch access scope was malformed.");
        }
        if (row.branch_id === branchScope.selectedBranchId) permittedRequestIds.add(row.id);
      }
    }

    const counts = { ok: 0, pending: 0, review: 0 };
    const items: DeliveryTriageItem[] = [];
    for (const row of scanned) {
      const conversation = conversations.get(row.conversation_id)!;
      if (permittedRequestIds &&
          (!conversation.requestId || !permittedRequestIds.has(conversation.requestId))) continue;
      const deliveryState = row.delivery_state as DeliveryState;
      const ageMinutes = Math.max(0, Math.floor((now.getTime() - Date.parse(row.created_at)) / 60000));
      let health: DeliveryHealth = "OK";
      let reason: DeliveryTriageItem["reason"];
      if (deliveryState === "FAILED" || deliveryState === "SUPPRESSED") {
        health = "NEEDS_REVIEW";
        reason = deliveryState === "FAILED" ? "PROVIDER_FAILURE" : "SUPPRESSED_BY_POLICY";
      } else if (["QUEUED", "RUNNING", "PROVIDER_ACCEPTED"].includes(deliveryState)) {
        if (ageMinutes >= 30) {
          health = "NEEDS_REVIEW";
          reason = "STALE_PENDING";
        } else health = "PENDING";
      }
      if (health === "OK") counts.ok++;
      else if (health === "PENDING") counts.pending++;
      else counts.review++;
      items.push({
        messageId: row.id, conversationId: row.conversation_id,
        channel: conversation.channel, deliveryState,
        createdAt: row.created_at, ageMinutes, health, ...(reason ? { reason } : {}),
      });
    }
    return { ok: true, value: {
      workspaceId: workspace.id,
      generatedAt: now.toISOString(),
      truncated: outbound.data.length > 200,
      scannedOutboundMessages: scanned.length, counts, items,
    } };
  } catch {
    return fail("DELIVERY_TRIAGE_READ_FAILED", "Operational delivery records are temporarily unavailable.");
  }
}

export async function loadOperationalDeliveryTriage(
  workspaceSlug: string,
): Promise<Result<DeliveryTriageSnapshot>> {
  return readOperationalDeliveryTriage(workspaceSlug, { resolveActor: resolveStaffActor });
}
