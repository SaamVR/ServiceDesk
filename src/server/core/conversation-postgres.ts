import type {
  ActorContext,
  AttentionItemDTO,
  ConversationDTO,
  InvoiceDTO,
  MessageDTO,
  QualityCaseDTO,
  RecurrenceRuleDTO,
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
  if (error) return { ok: false, code: error.code ?? fallbackCode, message: error.message };
  if (!data || data.ok === false) {
    return {
      ok: false,
      code: String(data?.code ?? fallbackCode),
      message: "Conversation command was rejected by the database RPC.",
    };
  }
  return { ok: true, value: value(data) };
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
  return {
    id: String(field(src, "id") ?? field(src, "conversationId", "conversation_id")),
    workspaceId: String(field(src, "workspaceId", "workspace_id")),
    requestId: maybeString(field(src, "requestId", "request_id")),
    customerId: maybeString(field(src, "customerId", "customer_id")),
    channel: String(field(src, "channel") ?? "WHATSAPP") as ConversationDTO["channel"],
    assignedUserId: maybeString(field(src, "assignedUserId", "assigned_user_id")),
    handoverActive: Boolean(field(src, "handoverActive", "handover_active")),
    version: Number(field(src, "version") ?? field(src, "conversationVersion", "conversation_version") ?? 0),
    lastMessageAt: maybeString(field(src, "lastMessageAt", "last_message_at")),
  };
}

function messageFromRpc(row: RpcRow): MessageDTO {
  const src = asRow(row.message) ?? row;
  return {
    id: String(field(src, "id") ?? field(src, "messageId", "message_id")),
    workspaceId: String(field(src, "workspaceId", "workspace_id")),
    conversationId: String(field(src, "conversationId", "conversation_id")),
    direction: String(field(src, "direction") ?? "OUTBOUND") as MessageDTO["direction"],
    senderKind: String(field(src, "senderKind", "sender_kind") ?? "STAFF") as MessageDTO["senderKind"],
    providerMessageId: maybeString(field(src, "providerMessageId", "provider_message_id")),
    body: maybeString(field(src, "body")),
    mediaReference: field(src, "mediaReference", "media_reference") as MessageDTO["mediaReference"],
    deliveryState: field(src, "deliveryState", "delivery_state") as MessageDTO["deliveryState"],
    createdAt: String(field(src, "createdAt", "created_at") ?? new Date(0).toISOString()),
  };
}

function invoiceFromRpc(row: RpcRow): InvoiceDTO {
  return {
    id: String(field(row, "id")),
    workspaceId: String(field(row, "workspaceId", "workspace_id")),
    visitId: maybeString(field(row, "visitId", "visit_id")),
    status: String(field(row, "status")) as InvoiceDTO["status"],
    currency: String(field(row, "currency")) as InvoiceDTO["currency"],
    totalMinor: Number(field(row, "totalMinor", "total_minor") ?? 0),
    allocatedMinor: Number(field(row, "allocatedMinor", "allocated_minor") ?? 0),
    refundedMinor: Number(field(row, "refundedMinor", "refunded_minor") ?? 0),
    balanceMinor: Number(field(row, "balanceMinor", "balance_minor") ?? 0),
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

export function createPostgresConversationFacadeMethods(
  client: SupabaseRpcClient,
): Pick<ServiceDeskFacade, "applyInboundMessage" | "setConversationHandover" | "enqueueConversationReply" | "readWorkspaceSnapshot"> {
  return {
    async applyInboundMessage(event: InboundMessageEvent): Promise<Result<InboundMessageApplicationOutcome>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_apply_inbound_message", { p_event: event });
      return asResult(data, error, "INBOUND_RPC_ERROR", (row) => {
        const messageRow = asRow(row.message) ?? (row.messageId || row.message_id ? row : undefined);
        return {
          state: String(row.state) as InboundMessageApplicationOutcome["state"],
          conversation: conversationFromRpc(row),
          message: messageRow ? messageFromRpc(messageRow) : undefined,
        };
      });
    },

    async setConversationHandover(ctx: ActorContext, id: string, input: ConversationHandoverInput, meta): Promise<Result<ConversationDTO>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_set_conversation_handover", {
        p_input: {
          workspaceId: ctx.workspaceId,
          actorRole: ctx.role,
          actorUserId: ctx.userId,
          conversationId: id,
          expectedVersion: meta.expectedVersion,
          ...input,
        },
      });
      return asResult(data, error, "HANDOVER_RPC_ERROR", conversationFromRpc);
    },

    async enqueueConversationReply(ctx: ActorContext, id: string, input: ConversationReplyInput, meta): Promise<Result<ConversationReplyOutcome>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_enqueue_conversation_reply", {
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
      return asResult(data, error, "REPLY_RPC_ERROR", (row) => ({
        message: messageFromRpc(row),
        outboxEventId: String(field(row, "outboxEventId", "outbox_event_id")),
      }));
    },

    async readWorkspaceSnapshot(ctx: ActorContext, query: WorkspaceSnapshotQuery): Promise<Result<WorkspaceSnapshot>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_read_workspace_snapshot", {
        p_input: { workspaceId: ctx.workspaceId, actorRole: ctx.role, actorUserId: ctx.userId, ...query },
      });
      return asResult(data, error, "SNAPSHOT_RPC_ERROR", (row) => ({
        requests: [],
        quotes: [],
        visits: [],
        invoices: rows(row.invoices).map(invoiceFromRpc),
        conversations: rows(row.conversations).map(conversationFromRpc),
        messages: rows(row.messages).map(messageFromRpc),
        recurrenceRules: rows(row.recurrenceRules).map(recurrenceRuleFromRpc),
        visitEvidence: rows(row.visitEvidence).map(visitEvidenceFromRpc),
        visitChecklistItems: rows(row.visitChecklistItems).map(checklistItemFromRpc),
        attentionItems: rows(row.attentionItems).map(attentionItemFromRpc),
        qualityCases: rows(row.qualityCases).map(qualityCaseFromRpc),
      }));
    },
  };
}
