import type {
  ActorContext,
  AttentionItemDTO,
  ConversationDTO,
  InvoiceDTO,
  MessageDTO,
  QualityCaseDTO,
  RecurrenceRuleDTO,
  RequestDTO,
  VisitDTO,
  Result,
  VisitChecklistItemDTO,
  VisitEvidenceDTO,
} from "../../contracts";
import type {
  ConversationHandoverInput,
  ConversationReplyInput,
  ConversationReplyOutcome,
  InboundMessageApplicationOutcome,
  InboundMessageEvent,
  ServiceDeskFacade,
  WorkspaceSnapshot,
  WorkspaceSnapshotQuery,
} from "./facade";
import type { SupabaseRpcClient } from "./payment-application-postgres";

type RpcRow = Record<string, unknown>;

function asResult<T>(
  data: RpcRow | null,
  error: { message: string; code?: string } | null,
  fallbackCode: string,
  value: (row: RpcRow) => T,
): Result<T> {
  const safeCode = (code: unknown) =>
    typeof code === "string" && /^[A-Z][A-Z0-9_]{0,79}$/.test(code)
      ? code : fallbackCode;
  // RPC errors and arbitrary machine codes may contain provider headers,
  // SQL diagnostics, customer identifiers or secrets: never echo them.
  if (error) return { ok: false, code: safeCode(error.code),
    message: "Conversation database operation could not be completed." };
  if (!data || typeof data !== "object" || Array.isArray(data) || data.ok !== true) {
    return { ok: false, code: safeCode(data?.code),
      message: "Conversation command was rejected by the database RPC." };
  }
  try { return { ok: true, value: value(data) }; }
  catch { return { ok: false, code: fallbackCode + "_MALFORMED",
    message: "Conversation database returned invalid evidence." }; }
}

function asRow(value: unknown): RpcRow | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RpcRow) : undefined;
}

function field(row: RpcRow, camel: string, snake?: string): unknown {
  return row[camel] ?? (snake ? row[snake] : undefined);
}

function maybeString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

function maybeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function rows(value: unknown): RpcRow[] {
  return Array.isArray(value) ? value.flatMap((item) => (asRow(item) ? [item as RpcRow] : [])) : [];
}

function conversationFromRpc(row: RpcRow): ConversationDTO {
  const src = asRow(row.conversation) ?? row;
  const id = field(src, "id") ?? field(src, "conversationId", "conversation_id");
  const workspaceId = field(src, "workspaceId", "workspace_id");
  const channel = field(src, "channel");
  const handoverActive = field(src, "handoverActive", "handover_active");
  const version = field(src, "version") ?? field(src, "conversationVersion", "conversation_version");
  // A missing saved field is not a false handover or version zero. In
  // particular Boolean("false") is true: coercing persisted evidence can
  // silently misroute a customer conversation to a staff member.
  if (typeof id !== "string" || !id ||
      typeof workspaceId !== "string" || !workspaceId ||
      !["WEB", "WHATSAPP", "EMAIL"].includes(String(channel)) ||
      typeof handoverActive !== "boolean" ||
      typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) {
    throw new Error("Malformed persisted conversation identity, handover or version");
  }
  return {
    id, workspaceId,
    requestId: maybeString(field(src, "requestId", "request_id")),
    customerId: maybeString(field(src, "customerId", "customer_id")),
    channel: channel as ConversationDTO["channel"],
    assignedUserId: maybeString(field(src, "assignedUserId", "assigned_user_id")),
    handoverActive, version,
    lastMessageAt: maybeString(field(src, "lastMessageAt", "last_message_at")),
  };
}

function messageFromRpc(row: RpcRow): MessageDTO {
  const src = asRow(row.message) ?? row;
  const id = field(src, "id") ?? field(src, "messageId", "message_id");
  const workspaceId = field(src, "workspaceId", "workspace_id");
  const conversationId = field(src, "conversationId", "conversation_id");
  const direction = field(src, "direction");
  const senderKind = field(src, "senderKind", "sender_kind");
  const createdAt = field(src, "createdAt", "created_at");
  const deliveryState = field(src, "deliveryState", "delivery_state");
  // A malformed saved message is NOT an outbound staff message dated 1970.
  // The installed inbound, reply and workspace-snapshot RPCs all project
  // these literal persisted fields; reject omissions rather than fabricating
  // a timestamp, direction, sender, or storage identity.
  if (typeof id !== "string" || !id ||
      typeof workspaceId !== "string" || !workspaceId ||
      typeof conversationId !== "string" || !conversationId ||
      !["INBOUND", "OUTBOUND", "INTERNAL"].includes(String(direction)) ||
      !["CUSTOMER", "STAFF", "AI", "SYSTEM"].includes(String(senderKind)) ||
      typeof createdAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(createdAt) ||
      !Number.isFinite(Date.parse(createdAt)) ||
      (deliveryState != null &&
        !["QUEUED", "RUNNING", "PROVIDER_ACCEPTED", "DELIVERED", "READ", "FAILED", "SUPPRESSED"]
          .includes(String(deliveryState)))) {
    throw new Error("Malformed persisted message identity, actor, delivery state or timestamp");
  }
  return {
    id, workspaceId, conversationId,
    direction: direction as MessageDTO["direction"],
    senderKind: senderKind as MessageDTO["senderKind"],
    providerMessageId: maybeString(field(src, "providerMessageId", "provider_message_id")),
    body: maybeString(field(src, "body")),
    mediaReference: field(src, "mediaReference", "media_reference") as MessageDTO["mediaReference"],
    deliveryState: deliveryState == null ? undefined : deliveryState as MessageDTO["deliveryState"],
    createdAt,
  };
}

// Installed servicedesk_read_workspace_snapshot projects actual request and
// visit rows. Never replace them with []: that conceals real, persisted work.
function savedString(row: RpcRow, key: string, snake?: string): string {
  const value = field(row, key, snake);
  if (typeof value !== "string" || !value.trim())
    throw new Error("Malformed saved snapshot identity or status");
  return value;
}
function savedCount(row: RpcRow, key: string, snake?: string): number {
  const value = field(row, key, snake);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("Malformed saved snapshot count or version");
  return value;
}
function savedTimestamp(row: RpcRow, key: string, snake?: string): string {
  const value = savedString(row, key, snake);
  if (!/(?:Z|[+-]\\d{2}:\\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value)))
    throw new Error("Malformed saved snapshot timestamp");
  return value;
}
function savedOptionalString(row: RpcRow, key: string, snake?: string): string | undefined {
  const value = field(row, key, snake);
  if (value == null) return undefined;
  return savedString(row, key, snake);
}
function savedOptionalTimestamp(row: RpcRow, key: string, snake?: string): string | undefined {
  return field(row, key, snake) == null ? undefined : savedTimestamp(row, key, snake);
}
function savedOptionalCount(row: RpcRow, key: string, snake?: string): number | undefined {
  return field(row, key, snake) == null ? undefined : savedCount(row, key, snake);
}
function requestFromRpc(row: RpcRow): RequestDTO {
  const status = savedString(row, "status");
  if (!["NEW","COLLECTING","READY","NEEDS_REVIEW","QUOTED","BOOKED","LOST","CLOSED"].includes(status))
    throw new Error("Malformed saved request status");
  return {
    id: savedString(row,"id"),
    workspaceId: savedString(row,"workspaceId","workspace_id"),
    customerId: savedOptionalString(row,"customerId","customer_id"),
    propertyId: savedOptionalString(row,"propertyId","property_id"),
    serviceCode: savedOptionalString(row,"serviceCode","service_code"),
    status: status as RequestDTO["status"],
    bedrooms: savedOptionalCount(row,"bedrooms"),
    bathrooms: savedOptionalCount(row,"bathrooms"),
    requestedStartAt: savedOptionalTimestamp(row,"requestedStartAt","requested_start_at"),
    version: savedCount(row,"version"),
    createdAt: savedTimestamp(row,"createdAt","created_at"),
    updatedAt: savedTimestamp(row,"updatedAt","updated_at"),
  };
}
function visitFromRpc(row: RpcRow): VisitDTO {
  const status = savedString(row,"status");
  if (!["AWAITING_PAYMENT","CONFIRMED","ASSIGNED","EN_ROUTE","IN_PROGRESS",
        "PENDING_REVIEW","COMPLETED","CANCELLED","PAYMENT_REVIEW"].includes(status))
    throw new Error("Malformed saved visit status");
  return {
    id: savedString(row,"id"),
    workspaceId: savedString(row,"workspaceId","workspace_id"),
    requestId: savedString(row,"requestId","request_id"),
    quoteId: savedString(row,"quoteId","quote_id"),
    crewId: savedOptionalString(row,"crewId","crew_id"),
    status: status as VisitDTO["status"],
    startAt: savedTimestamp(row,"startAt","start_at"),
    serviceMinutes: savedCount(row,"serviceMinutes","service_minutes"),
    bufferMinutes: savedCount(row,"bufferMinutes","buffer_minutes"),
    version: savedCount(row,"version"),
  };
}

function invoiceFromRpc(row: RpcRow): InvoiceDTO {
  const status = field(row, "status");
  const currency = field(row, "currency");
  const money = (key: string, snake: string) => field(row, key, snake);
  const totalMinor = money("totalMinor", "total_minor");
  const allocatedMinor = money("allocatedMinor", "allocated_minor");
  const refundedMinor = money("refundedMinor", "refunded_minor");
  const balanceMinor = money("balanceMinor", "balance_minor");
  const amounts = [totalMinor, allocatedMinor, refundedMinor, balanceMinor];
  // A missing/non-numeric field cannot be "helpfully" coerced into zero:
  // that would present a damaged ledger as a verified empty finance queue.
  if (!["DRAFT","ISSUED","PARTIALLY_PAID","PAID","VOID"].includes(String(status)) ||
      typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency) ||
      amounts.some(v => typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) ||
      (allocatedMinor as number) < (refundedMinor as number) ||
      !Number.isSafeInteger((allocatedMinor as number) - (refundedMinor as number)) ||
      !Number.isSafeInteger((allocatedMinor as number) - (refundedMinor as number) + (balanceMinor as number)) ||
      (allocatedMinor as number) - (refundedMinor as number) + (balanceMinor as number) !== totalMinor ||
      (status === "PAID" && balanceMinor !== 0)) {
    throw new Error("Malformed workspace invoice monetary evidence");
  }
  return {
    id: String(field(row, "id")),
    workspaceId: String(field(row, "workspaceId", "workspace_id")),
    visitId: maybeString(field(row, "visitId", "visit_id")),
    status: status as InvoiceDTO["status"], currency: currency as InvoiceDTO["currency"],
    totalMinor: totalMinor as number, allocatedMinor: allocatedMinor as number,
    refundedMinor: refundedMinor as number, balanceMinor: balanceMinor as number,
  };
}

function recurrenceRuleFromRpc(row: RpcRow): RecurrenceRuleDTO {
  return {
    id: String(field(row, "id")),
    workspaceId: String(field(row, "workspaceId", "workspace_id")),
    requestId: String(field(row, "requestId", "request_id")),
    propertyId: String(field(row, "propertyId", "property_id")),
    frequency: String(field(row, "frequency")) as RecurrenceRuleDTO["frequency"],
    timezone: String(field(row, "timezone")),
    localStartTime: String(field(row, "localStartTime", "local_start_time")),
    startsOn: String(field(row, "startsOn", "starts_on")),
    endsOn: maybeString(field(row, "endsOn", "ends_on")),
    maxOccurrences: maybeNumber(field(row, "maxOccurrences", "max_occurrences")),
    generatedOccurrences: Number(field(row, "generatedOccurrences", "generated_occurrences") ?? 0),
    status: String(field(row, "status")) as RecurrenceRuleDTO["status"],
    nextOccurrenceOn: maybeString(field(row, "nextOccurrenceOn", "next_occurrence_on")),
    version: Number(field(row, "version") ?? 0),
    createdAt: String(field(row, "createdAt", "created_at")),
    updatedAt: String(field(row, "updatedAt", "updated_at")),
  };
}

function visitEvidenceFromRpc(row: RpcRow): VisitEvidenceDTO {
  return {
    id: String(field(row, "id")),
    workspaceId: String(field(row, "workspaceId", "workspace_id")),
    visitId: String(field(row, "visitId", "visit_id")),
    kind: String(field(row, "kind")) as VisitEvidenceDTO["kind"],
    mediaReference: field(row, "mediaReference", "media_reference") as VisitEvidenceDTO["mediaReference"],
    text: maybeString(field(row, "text")),
    capturedAt: String(field(row, "capturedAt", "captured_at")),
    submittedByUserId: String(field(row, "submittedByUserId", "submitted_by_user_id")),
    createdAt: String(field(row, "createdAt", "created_at")),
  };
}

function checklistItemFromRpc(row: RpcRow): VisitChecklistItemDTO {
  return {
    id: String(field(row, "id")),
    workspaceId: String(field(row, "workspaceId", "workspace_id")),
    visitId: String(field(row, "visitId", "visit_id")),
    itemKey: String(field(row, "itemKey", "item_key")),
    completed: Boolean(field(row, "completed")),
    note: maybeString(field(row, "note")),
    updatedByUserId: String(field(row, "updatedByUserId", "updated_by_user_id")),
    updatedAt: String(field(row, "updatedAt", "updated_at")),
    version: Number(field(row, "version") ?? 0),
  };
}

function attentionItemFromRpc(row: RpcRow): AttentionItemDTO {
  return {
    id: String(field(row, "id")),
    workspaceId: String(field(row, "workspaceId", "workspace_id")),
    type: String(field(row, "type")),
    severity: String(field(row, "severity")) as AttentionItemDTO["severity"],
    status: String(field(row, "status")) as AttentionItemDTO["status"],
    resourceType: String(field(row, "resourceType", "resource_type")),
    resourceId: String(field(row, "resourceId", "resource_id")),
    ownerUserId: maybeString(field(row, "ownerUserId", "owner_user_id")),
    dueAt: maybeString(field(row, "dueAt", "due_at")),
    summary: String(field(row, "summary")),
  };
}

function qualityCaseFromRpc(row: RpcRow): QualityCaseDTO {
  return {
    id: String(field(row, "id")),
    workspaceId: String(field(row, "workspaceId", "workspace_id")),
    visitId: String(field(row, "visitId", "visit_id")),
    state: String(field(row, "state")) as QualityCaseDTO["state"],
    feedbackScore: maybeNumber(field(row, "feedbackScore", "feedback_score")),
    summary: String(field(row, "summary")),
    ownerUserId: maybeString(field(row, "ownerUserId", "owner_user_id")),
    dueAt: maybeString(field(row, "dueAt", "due_at")),
    resolutionNote: maybeString(field(row, "resolutionNote", "resolution_note")),
    reviewRequestState: String(field(row, "reviewRequestState", "review_request_state")) as QualityCaseDTO["reviewRequestState"],
    version: Number(field(row, "version") ?? 0),
    createdAt: String(field(row, "createdAt", "created_at")),
    updatedAt: String(field(row, "updatedAt", "updated_at")),
  };
}

async function safeRpc(client: SupabaseRpcClient, fn: string, args: Record<string, unknown>) {
  try { return await client.rpc<RpcRow>(fn, args); }
  catch { return null; }
}

export function createPostgresConversationFacadeMethods(
  client: SupabaseRpcClient,
): Pick<ServiceDeskFacade, "applyInboundMessage" | "setConversationHandover" | "enqueueConversationReply" | "readWorkspaceSnapshot"> {
  return {
    async applyInboundMessage(event: InboundMessageEvent): Promise<Result<InboundMessageApplicationOutcome>> {
      const rpcName = event.channel === "EMAIL"
        ? "servicedesk_apply_inbound_email_message"
        : "servicedesk_apply_inbound_message";
      const result = await safeRpc(client, rpcName, { p_event: event });
      if (!result) return { ok: false, code:"INBOUND_RPC_UNAVAILABLE",
        message:"Inbound conversation database is temporarily unavailable." };
      const parsed = asResult(result.data, result.error, "INBOUND_RPC_ERROR", (row) => {
        const messageRow = asRow(row.message) ?? (row.messageId || row.message_id ? row : undefined);
        return {
          state: String(row.state) as InboundMessageApplicationOutcome["state"],
          conversation: conversationFromRpc(row),
          message: messageRow ? messageFromRpc(messageRow) : undefined,
        };
      });
      if (!parsed.ok) return parsed;
      const { state, conversation, message } = parsed.value;
      // These RPCs run under a trusted server client, so a malformed or
      // cross-tenant projection must fail closed before reaching the inbox.
      if (state !== "APPLIED" && state !== "DUPLICATE") {
        return { ok: false, code: "INBOUND_RPC_INVALID_STATE",
          message: "Conversation RPC returned an invalid inbound state." };
      }
      if (!conversation.id || conversation.id === "undefined" ||
          conversation.workspaceId !== event.workspaceId ||
          conversation.channel !== event.channel ||
          !Number.isSafeInteger(conversation.version) || conversation.version < 0 ||
          // SQL receipts are untrusted until bound back to the exact inbound
          // customer source. A missing provider id, outbound/AI sender, or
          // cross-channel conversation cannot certify a committed inbound.
          (message && (message.workspaceId !== event.workspaceId ||
            message.conversationId !== conversation.id ||
            message.direction !== "INBOUND" ||
            message.senderKind !== "CUSTOMER" ||
            message.id === "undefined" ||
            message.providerMessageId !== event.providerMessageId))) {
        return { ok: false, code: "INBOUND_RPC_SCOPE_MISMATCH",
          message: "Conversation RPC returned an invalid tenant or message identity." };
      }
      return parsed;
    },

    async setConversationHandover(ctx: ActorContext, id: string, input: ConversationHandoverInput, meta): Promise<Result<ConversationDTO>> {
      const result = await safeRpc(client, "servicedesk_set_conversation_handover", {
        p_input: {
          workspaceId: ctx.workspaceId,
          actorRole: ctx.role,
          actorUserId: ctx.userId,
          conversationId: id,
          expectedVersion: meta.expectedVersion,
          ...input,
        },
      });
      if (!result) return { ok:false, code:"HANDOVER_RPC_UNAVAILABLE",
        message:"Handover database is temporarily unavailable." };
      const parsed = asResult(result.data, result.error, "HANDOVER_RPC_ERROR", conversationFromRpc);
      if (!parsed.ok) return parsed;
      // SQL success is not evidence that the intended handover transition
      // actually persisted. A missing flag, string "false", unchanged active
      // state or wrong assigned staff must not be acknowledged as successful.
      const persisted = asRow(asRow(result.data)?.conversation) ?? asRow(result.data);
      const rawActive = persisted ? field(persisted, "handoverActive", "handover_active") : undefined;
      const savedAssignment = persisted ? field(persisted, "assignedUserId", "assigned_user_id") : undefined;
      // The installed SQL chooses the requesting staff member by default on
      // activation, and clears the assignee on deactivation. Verify that
      // actual readback rather than accepting any active/idle boolean.
      const expectedAssignee = input.active ? (input.assignedUserId ?? ctx.userId) : undefined;
      const assignmentMatches = input.active
        ? typeof savedAssignment === "string" && savedAssignment === expectedAssignee
        : savedAssignment == null;
      if (parsed.value.id !== id || parsed.value.workspaceId !== ctx.workspaceId ||
          !Number.isSafeInteger(parsed.value.version) || parsed.value.version < 0 ||
          typeof rawActive !== "boolean" || rawActive !== input.active ||
          !assignmentMatches) {
        return {ok:false,code:"HANDOVER_RPC_SCOPE_MISMATCH",
          message:"The saved handover identity and state could not be verified."};
      }
      return parsed;
    },

    async enqueueConversationReply(ctx: ActorContext, id: string, input: ConversationReplyInput, meta): Promise<Result<ConversationReplyOutcome>> {
      const result = await safeRpc(client, "servicedesk_enqueue_conversation_reply", {
        p_input: {
          workspaceId: ctx.workspaceId,
          actorRole: ctx.role,
          actorUserId: ctx.userId,
          conversationId: id,
          expectedVersion: meta.expectedVersion,
          idempotencyKey: meta.idempotencyKey,
          ...input,
        },
      });
      if (!result) return { ok:false, code:"REPLY_RPC_UNAVAILABLE",
        message:"Conversation reply database is temporarily unavailable." };
      const parsed = asResult(result.data, result.error, "REPLY_RPC_ERROR", (row) => ({
        message: messageFromRpc(row),
        outboxEventId: String(field(row, "outboxEventId", "outbox_event_id")),
      }));
      if (!parsed.ok) return parsed;
      if (parsed.value.message.workspaceId !== ctx.workspaceId ||
          parsed.value.message.conversationId !== id ||
          parsed.value.message.direction !== "OUTBOUND" ||
          parsed.value.message.senderKind !== "STAFF" ||
          parsed.value.message.body !== input.body ||
          !parsed.value.outboxEventId || parsed.value.outboxEventId === "undefined" ||
          parsed.value.message.id === "undefined") {
        return {ok:false,code:"REPLY_RPC_SCOPE_MISMATCH",
          message:"The queued reply does not match the approved conversation."};
      }
      return parsed;
    },

    async readWorkspaceSnapshot(ctx: ActorContext, query: WorkspaceSnapshotQuery): Promise<Result<WorkspaceSnapshot>> {
      const result = await safeRpc(client, "servicedesk_read_workspace_snapshot", {
        p_input: { workspaceId: ctx.workspaceId, actorRole: ctx.role, actorUserId: ctx.userId, ...query },
      });
      if (!result) return { ok:false, code:"SNAPSHOT_RPC_UNAVAILABLE",
        message:"Workspace snapshot database is temporarily unavailable." };
      const parsed = asResult(result.data, result.error, "SNAPSHOT_RPC_ERROR", (row) => {
        // A corrupt RPC array or an invalid item is not an empty queue.
        // Older/partial SQL snapshots may omit a collection, but a present
        // collection must be losslessly projectable before any staff use.
        const keys = ["requests","quotes","visits","invoices","conversations",
          "messages","recurrenceRules","visitEvidence","visitChecklistItems",
          "attentionItems","qualityCases"] as const;
        if (keys.some(key =>
          row[key] !== undefined && (!Array.isArray(row[key]) ||
          (row[key] as unknown[]).some(item => !asRow(item))))) {
          throw new Error("Malformed workspace snapshot collection");
        }
        if (Array.isArray(row.quotes) && row.quotes.length > 0)
          throw new Error("Unsupported quote snapshot projection");
        return {
        requests: rows(row.requests).map(requestFromRpc),
        // Current installed SQL deliberately returns no direct quote rows;
        // nonempty future quote payloads must not be mislabeled an empty queue.
        quotes: [],
        visits: rows(row.visits).map(visitFromRpc),
        invoices: rows(row.invoices).map(invoiceFromRpc),
        conversations: rows(row.conversations).map(conversationFromRpc),
        messages: rows(row.messages).map(messageFromRpc),
        recurrenceRules: rows(row.recurrenceRules).map(recurrenceRuleFromRpc),
        visitEvidence: rows(row.visitEvidence).map(visitEvidenceFromRpc),
        visitChecklistItems: rows(row.visitChecklistItems).map(checklistItemFromRpc),
        attentionItems: rows(row.attentionItems).map(attentionItemFromRpc),
        qualityCases: rows(row.qualityCases).map(qualityCaseFromRpc),
        };
      });
      if (!parsed.ok) return parsed;
      const snapshot=parsed.value;
      // Reject foreign-tenant rows even if a broken server-side RPC returned
      // them. Do not silently collapse data into a seemingly valid snapshot.
      const collections=[snapshot.requests,snapshot.visits,snapshot.invoices,
        snapshot.conversations,snapshot.messages,snapshot.recurrenceRules,
        snapshot.visitEvidence,snapshot.visitChecklistItems,
        snapshot.attentionItems,snapshot.qualityCases];
      if (collections.some(list => list.some(item => item.workspaceId !== ctx.workspaceId))) {
        return {ok:false,code:"SNAPSHOT_RPC_SCOPE_MISMATCH",
          message:"Workspace snapshot contained unrelated tenant records."};
      }
      return parsed;
    },
  };
}
