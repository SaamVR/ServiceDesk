import type { Result, MessageDeliveryState } from "../../contracts";
import { verifiedReviewedReplyBody } from "./reviewed-reply-input";
import { resolveStaffActor, requireOperationalBranchResource, type ResolvedStaffActor } from "../../features/operations/operational-product-runtime";
import { createPostgresConversationFacadeMethods } from "./conversation-postgres";
import type { ConversationReplyOutcome } from "./facade";

export interface ReviewedInboxReplyInput {
  workspaceSlug: string;
  conversationId: string;
  sourceMessageId: string;
  reviewedBody: string;
  expectedVersion: number;
  idempotencyKey: string;
  confirmedByStaff: true;
}
export interface ReviewedInboxReplyDependencies {
  resolveActor: (workspaceSlug: string) => Promise<
    { ok: true; value: ResolvedStaffActor } |
    { ok: false; kind: string; message: string }
  >;
  requireBranch: (actor: ResolvedStaffActor, conversationId: string) => Promise<
    { ok: boolean; message: string } | undefined
  >;
}
export interface ReviewedInboxReplyReceipt {
  state: "QUEUED_FOR_PROVIDER" | "EXISTING_REPLY";
  workspaceId: string;
  conversationId: string;
  sourceMessageId: string;
  outboundMessageId: string;
  outboxEventId: string;
  deliveryState: MessageDeliveryState;
}

function failure(code: string, message: string): Result<never> {
  return { ok: false, code, message };
}
function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value);
}

/**
 * This command is a separate, EXPLICIT staff approval. A model cannot invoke
 * it: an authenticated owner/dispatcher must review/edit text and submit with
 * an exact saved inbound message and expected conversation version.
 *
 * The existing SQL RPC checks active membership, verified contact, consent,
 * expected version and idempotency before inserting a durable outbox event.
 * Its replay result is checked here for exact body/conversation identity,
 * because an idempotency key must never acknowledge a different reply.
 */
export async function approveReviewedInboxReply(
  input: ReviewedInboxReplyInput,
  deps: ReviewedInboxReplyDependencies,
): Promise<Result<ReviewedInboxReplyReceipt>> {
  if (input.confirmedByStaff !== true ||
      typeof input.workspaceSlug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.workspaceSlug) ||
      !validId(input.conversationId) || !validId(input.sourceMessageId) ||
      !verifiedReviewedReplyBody(input.reviewedBody) ||
      !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1 ||
      typeof input.idempotencyKey !== "string" ||
      !/^[A-Za-z0-9_-]{12,128}$/.test(input.idempotencyKey)) {
    return failure("REVIEWED_REPLY_INPUT_INVALID", "A complete and explicitly confirmed staff reply is required.");
  }
  const body = input.reviewedBody.trim();
  let resolved: Awaited<ReturnType<ReviewedInboxReplyDependencies["resolveActor"]>>;
  try { resolved = await deps.resolveActor(input.workspaceSlug); }
  catch {
    return failure("REVIEWED_REPLY_AUTH_UNAVAILABLE", "Staff membership verification is unavailable.");
  }
  if (!resolved.ok) {
    return failure("REVIEWED_REPLY_STAFF_REQUIRED", "Active workspace staff membership is required.");
  }
  const { actor, workspace, service, rpc } = resolved.value;
  if (workspace.slug !== input.workspaceSlug ||
      workspace.id !== actor.workspaceId || !actor.userId ||
      (actor.role !== "OWNER" && actor.role !== "DISPATCHER")) {
    return failure("REVIEWED_REPLY_STAFF_REQUIRED", "The selected workspace is not authorized.");
  }
  try {
    const scoped = await deps.requireBranch(resolved.value, input.conversationId);
    if (scoped) return failure("REVIEWED_REPLY_BRANCH_DENIED", "Conversation is outside the assigned branch.");

    const conversation = await service.from("conversations")
      .select("id,workspace_id,channel,version,customer_id")
      .eq("workspace_id", workspace.id)
      .eq("id", input.conversationId)
      .maybeSingle();
    if (conversation.error || !conversation.data ||
        conversation.data.id !== input.conversationId ||
        conversation.data.workspace_id !== workspace.id) {
      return failure("REVIEWED_REPLY_CONVERSATION_UNAVAILABLE", "Conversation is unavailable.");
    }
    const current = conversation.data;
    if ((current.channel !== "WHATSAPP" && current.channel !== "EMAIL") ||
        typeof current.customer_id !== "string") {
      return failure("REVIEWED_REPLY_CHANNEL_OR_CUSTOMER_INVALID", "Reply channel or verified customer is unavailable.");
    }

    // Confirm that the approved draft is still associated with the latest
    // inbound customer message. Race with a newly-arriving message is caught
    // again by the RPC's locked conversation-version predicate.
    const lastMessage = await service.from("messages")
      .select("id,workspace_id,conversation_id,direction,sender_kind,created_at")
      .eq("workspace_id", workspace.id)
      .eq("conversation_id", input.conversationId)
      .eq("direction", "INBOUND")
      .eq("sender_kind", "CUSTOMER")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastMessage.error || !lastMessage.data ||
        lastMessage.data.id !== input.sourceMessageId ||
        lastMessage.data.workspace_id !== workspace.id ||
        lastMessage.data.conversation_id !== input.conversationId ||
        lastMessage.data.direction !== "INBOUND" ||
        lastMessage.data.sender_kind !== "CUSTOMER" ||
        typeof lastMessage.data.created_at !== "string" ||
        !Number.isFinite(Date.parse(lastMessage.data.created_at))) {
      return failure("REVIEWED_REPLY_SOURCE_STALE", "A newer customer message requires another review.");
    }

    // Staff may retry after a network timeout even though the first RPC
    // already queued the message and incremented conversation.version.
    // Look up the SAME approved idempotency key only after authorizing the
    // latest inbound message. A replay is read-only; never queue another send.
    const prior = await service.from("messages")
      .select("id,workspace_id,conversation_id,outbound_idempotency_key,outbox_event_id,direction,sender_kind,body,delivery_state,created_at")
      .eq("workspace_id", workspace.id)
      .eq("outbound_idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (prior.error) {
      return failure("REVIEWED_REPLY_REPLAY_READ_FAILED", "Prior approved reply could not be verified.");
    }
    if (prior.data) {
      const m = prior.data;
      if (!validId(m.id) || m.workspace_id !== workspace.id ||
          m.conversation_id !== input.conversationId ||
          m.outbound_idempotency_key !== input.idempotencyKey ||
          m.direction !== "OUTBOUND" || m.sender_kind !== "STAFF" ||
          m.body !== body || !validId(m.outbox_event_id) ||
          typeof m.created_at !== "string" ||
          !Number.isFinite(Date.parse(m.created_at)) ||
          Date.parse(m.created_at) < Date.parse(lastMessage.data.created_at) ||
          !["QUEUED", "RUNNING", "PROVIDER_ACCEPTED", "DELIVERED", "READ", "FAILED", "SUPPRESSED"].includes(m.delivery_state)) {
        return failure("REVIEWED_REPLY_RECEIPT_MISMATCH", "An existing idempotency key was used for another reply.");
      }
      const event = await service.from("outbox_events")
        .select("id,workspace_id,topic,idempotency_key,status,provider_reference")
        .eq("id", m.outbox_event_id)
        .eq("workspace_id", workspace.id)
        .maybeSingle();
      const o = event.data;
      if (event.error || !o || o.id !== m.outbox_event_id ||
          o.workspace_id !== workspace.id || o.topic !== "conversation.reply" ||
          o.idempotency_key !==
            `conversation.reply:${workspace.id}:${input.idempotencyKey}` ||
          !["PENDING", "SENT", "FAILED", "SUPPRESSED"].includes(o.status)) {
        return failure("REVIEWED_REPLY_RECEIPT_MISMATCH", "A previous reply has no verified outbox event.");
      }
      // The outbound message may still say QUEUED after the outbox records
      // provider acceptance/terminal state. Never call that DELIVERED or READ.
      let deliveryState: MessageDeliveryState = m.delivery_state;
      if (deliveryState === "QUEUED" || deliveryState === "RUNNING") {
        if (o.status === "SENT" && typeof o.provider_reference === "string" &&
            o.provider_reference.trim()) deliveryState = "PROVIDER_ACCEPTED";
        else if (o.status === "FAILED") deliveryState = "FAILED";
        else if (o.status === "SUPPRESSED") deliveryState = "SUPPRESSED";
      }
      return { ok: true, value: {
        state: "EXISTING_REPLY", workspaceId: workspace.id,
        conversationId: input.conversationId, sourceMessageId: input.sourceMessageId,
        outboundMessageId: m.id, outboxEventId: o.id, deliveryState,
      } };
    }
    if (current.version !== input.expectedVersion) {
      return failure("REVIEWED_REPLY_VERSION_CONFLICT", "Conversation changed; refresh and review again.");
    }

    const queued: Result<ConversationReplyOutcome> =
      await createPostgresConversationFacadeMethods(rpc).enqueueConversationReply(
        actor, input.conversationId, { body, channel: current.channel },
        { now: new Date().toISOString(), expectedVersion: input.expectedVersion,
          idempotencyKey: input.idempotencyKey },
      );
    if (!queued.ok) {
      // Never reflect raw database errors or recipient/customer details.
      if (queued.code === "VERSION_CONFLICT") {
        return failure("REVIEWED_REPLY_VERSION_CONFLICT", "Conversation changed; refresh and review again.");
      }
      if (queued.code === "REPLY_CONSENT_REQUIRED") {
        return failure("REVIEWED_REPLY_CONSENT_REQUIRED", "The customer has not consented to this channel.");
      }
      return failure("REVIEWED_REPLY_QUEUE_REJECTED", "Reply could not be queued; review the current conversation.");
    }
    const { message, outboxEventId } = queued.value;
    if (message.workspaceId !== workspace.id ||
        message.conversationId !== input.conversationId ||
        message.direction !== "OUTBOUND" || message.senderKind !== "STAFF" ||
        message.body !== body || !validId(message.id) ||
        !validId(outboxEventId) ||
        !["QUEUED", "RUNNING", "PROVIDER_ACCEPTED", "DELIVERED", "READ", "FAILED", "SUPPRESSED"].includes(message.deliveryState ?? "") ||
        !Number.isFinite(Date.parse(message.createdAt)) ||
        Date.parse(message.createdAt) < Date.parse(lastMessage.data.created_at)) {
      return failure("REVIEWED_REPLY_RECEIPT_MISMATCH", "The queued reply did not match the reviewed message.");
    }
    return { ok: true, value: {
      state: message.deliveryState === "QUEUED" ? "QUEUED_FOR_PROVIDER" : "EXISTING_REPLY",
      workspaceId: workspace.id,
      conversationId: input.conversationId,
      sourceMessageId: input.sourceMessageId,
      outboundMessageId: message.id,
      outboxEventId,
      deliveryState: message.deliveryState!,
    } };
  } catch {
    return failure("REVIEWED_REPLY_UNAVAILABLE", "Reply verification is temporarily unavailable.");
  }
}

/** The real staff operation uses cookie-backed Auth and branch permissions,
 * not caller-provided user identifiers. It never bypasses the existing SQL RPC.
 */
export async function queueApprovedInboxReply(
  input: ReviewedInboxReplyInput,
): Promise<Result<ReviewedInboxReplyReceipt>> {
  return approveReviewedInboxReply(input, {
    resolveActor: resolveStaffActor,
    requireBranch: (actor, conversationId) => requireOperationalBranchResource(actor, "conversation", conversationId),
  });
}
