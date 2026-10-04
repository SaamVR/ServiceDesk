import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mapProductActionError } from "../../src/features/operations/action-state";
import { buildInboxThreadView } from "../../src/features/inbox/view-models";
import { buildInboxSnapshotFromWorkspaceSnapshot, createInboxServerActionFactory } from "../../src/features/inbox/server-boundary";

const root = process.cwd();
function source(path: string) { return readFileSync(join(root, path), "utf8"); }

describe("E05 Product inbox Core contract alignment", () => {
  const ctx = { workspaceId: "ws_1", role: "DISPATCHER", userId: "dispatcher" } as const;
  const meta = { idempotencyKey: "idem_1", now: "2026-10-04T06:30:00.000Z" } as const;
  const conversation = { id: "conv_1", workspaceId: "ws_1", requestId: "req_1", customerId: "cust_1", channel: "WHATSAPP", handoverActive: false, version: 7 } as never;
  const otherConversation = { id: "conv_2", workspaceId: "ws_1", requestId: "req_2", customerId: "cust_2", channel: "EMAIL", handoverActive: false, version: 3 } as never;
  const message = { id: "msg_1", workspaceId: "ws_1", conversationId: "conv_1", direction: "OUTBOUND", senderKind: "STAFF", body: "Checking now", deliveryState: "PROVIDER_ACCEPTED", createdAt: "2026-10-04T06:20:00.000Z" } as never;
  const otherMessage = { ...(message as object), id: "msg_other", conversationId: "conv_2", body: "Other thread" } as never;
  const snapshot = { conversations: [conversation, otherConversation], messages: [message, otherMessage], requests: [{ id: "req_1", workspaceId: "ws_1", status: "QUOTED", serviceCode: "MOVE_OUT", version: 1, createdAt: "2026-10-04T06:00:00.000Z", updatedAt: "2026-10-04T06:00:00.000Z" }], quotes: [], visits: [], invoices: [] } as never;

  it("uses frozen Core E05 types and command signatures without a local WorkspaceSnapshot shadow", () => {
    const boundary = source("src/features/inbox/server-boundary.ts");
    expect(boundary).not.toContain("export interface WorkspaceSnapshot");
    expect(boundary).not.toContain("customers?:");
    expect(boundary).toContain("import type { ActorContext, CommandMeta");
    expect(boundary).toContain("from \"@/server/core/facade\"");
    expect(boundary).toContain("readWorkspaceSnapshot(ctx: ActorContext, query: WorkspaceSnapshotQuery)");
    expect(boundary).toContain("setConversationHandover(");
    expect(boundary).toContain("conversationId: string,");
    expect(boundary).toContain("input: ConversationHandoverInput,");
    expect(boundary).toContain("enqueueConversationReply(");
    expect(boundary).toContain("input: ConversationReplyInput,");
    expect(boundary).toContain("Promise<Result<ConversationReplyOutcome>>");
  });

  it("keeps reusable inbox fixture-free and route data driven", () => {
    expect(source("src/features/inbox/InboxPreview.tsx")).not.toContain("sampleMessages");
    expect(source("src/features/inbox/InboxPreview.tsx")).not.toContain("sampleThread");
    expect(source("src/features/inbox/InboxFixturePreview.tsx")).toContain("fixtureMessages");
    expect(source("src/features/operations/OperationalRoute.tsx")).toContain("data?.staff.inbox ? <InboxPreview");
  });

  it("maps durable delivery states truthfully", () => {
    const view = buildInboxThreadView({ conversation, messages: [message, { ...(message as object), id: "msg_read", deliveryState: "READ" } as never, { ...(message as object), id: "msg_failed", deliveryState: "FAILED" } as never, { ...(message as object), id: "msg_suppressed", deliveryState: "SUPPRESSED" } as never], customerLabel: "Customer", requestLabel: "MOVE_OUT" });
    expect(view.messages.map((item) => item.deliveryLabel)).toEqual(["Provider accepted — not proof of delivery", "Read by recipient", "Failed — staff recovery required", "Suppressed by consent/policy"]);
    expect(view.messages.map((item) => item.tone)).toEqual(["pending", "success", "failure", "attention"]);
  });

  it("filters broad workspace snapshots and fails closed for cross-workspace data", () => {
    const mapped = buildInboxSnapshotFromWorkspaceSnapshot(snapshot, "conv_1", ctx.workspaceId);
    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(mapped.value.messages).toHaveLength(1);
      expect(mapped.value.messages[0]?.id).toBe("msg_1");
      expect(mapped.value.customerLabel).toBe("Customer cust_1");
    }
    expect(buildInboxSnapshotFromWorkspaceSnapshot({ ...(snapshot as object), conversations: [{ ...(conversation as object), workspaceId: "other_ws" }] } as never, "conv_1", ctx.workspaceId).ok).toBe(false);
    expect(buildInboxSnapshotFromWorkspaceSnapshot({ ...(snapshot as object), messages: [{ ...(message as object), workspaceId: "other_ws" }] } as never, "conv_1", ctx.workspaceId).ok).toBe(false);
    expect(buildInboxSnapshotFromWorkspaceSnapshot(snapshot, "missing_conv", ctx.workspaceId).ok).toBe(false);
  });

  it("delegates exact Core signatures, propagates expectedVersion, and preserves ConversationReplyOutcome", async () => {
    const calls: string[] = [];
    const action = createInboxServerActionFactory({
      async readWorkspaceSnapshot(readCtx, query) { calls.push(`read:${readCtx.workspaceId}:${query.conversationId}`); return { ok: true, value: snapshot }; },
      async setConversationHandover(handoverCtx, conversationId, input, commandMeta) { calls.push(`handover:${handoverCtx.workspaceId}:${conversationId}:${input.active}:${input.assignedUserId ?? "none"}:${commandMeta.expectedVersion}`); return { ok: true, value: { ...(conversation as object), handoverActive: input.active, assignedUserId: input.assignedUserId, version: (commandMeta.expectedVersion ?? 0) + 1 } as never }; },
      async enqueueConversationReply(replyCtx, conversationId, input, commandMeta) { calls.push(`reply:${replyCtx.workspaceId}:${conversationId}:${input.channel}:${input.body}:${commandMeta.expectedVersion}:${commandMeta.idempotencyKey}`); return { ok: true, value: { message: { ...(message as object), id: "msg_reply", body: input.body } as never, outboxEventId: "outbox_1" } }; },
    });
    expect((await action.loadInbox({ ctx, query: { conversationId: "conv_1" }, selectedConversationId: "conv_1" })).ok).toBe(true);
    expect((await action.setHandover({ ctx, conversation, active: true, assignedUserId: "dispatcher", meta })).ok).toBe(true);
    const reply = await action.enqueueReply({ ctx, conversation, body: "Confirmed", channel: "WHATSAPP", meta: { ...meta, idempotencyKey: "reply_idem" } });
    expect(reply.ok).toBe(true);
    expect(reply.value?.message.id).toBe("msg_reply");
    expect(reply.value?.outboxEventId).toBe("outbox_1");
    expect(calls).toEqual(["read:ws_1:conv_1", "handover:ws_1:conv_1:true:dispatcher:7", "reply:ws_1:conv_1:WHATSAPP:Confirmed:7:reply_idem"]);
    expect((conversation as { handoverActive: boolean }).handoverActive).toBe(false);
  });

  it("maps E05 action failures and avoids provider/Core repository imports", () => {
    expect(mapProductActionError({ code: "CONVERSATION_NOT_FOUND", message: "missing" }).status).toBe("conversation_not_found");
    expect(mapProductActionError({ code: "REPLY_VALIDATION_FAILED", message: "bad" }).status).toBe("reply_validation_error");
    expect(mapProductActionError({ code: "RECIPIENT_CONSENT_BLOCKED", message: "blocked" }).status).toBe("consent_blocked");
    expect(mapProductActionError({ code: "OUTBOUND_ENQUEUE_FAILED", message: "queue" }).status).toBe("outbound_enqueue_failed");
    expect(mapProductActionError({ code: "SNAPSHOT_AUTHORIZATION_FAILED", message: "auth" }).status).toBe("snapshot_auth_failed");
    for (const path of ["src/features/inbox/server-boundary.ts", "src/features/inbox/view-models.ts", "src/features/inbox/InboxPreview.tsx", "src/app/app/[workspace]/inbox/server-actions.ts"]) {
      const file = source(path);
      expect(file, path).not.toContain("repositories");
      expect(file, path).not.toContain("@/server/integrations");
      expect(file, path).not.toContain("stripe");
      expect(file, path).not.toContain("whatsapp");
      expect(file, path).not.toContain("google-calendar");
    }
  });
});
