import { deepEqual, equal, ok as assert } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mapProductActionError } from "../../src/features/operations/action-state";
import { disabledProductMutationResult } from "../../src/features/operations/server-action-adapters";
import { buildInboxThreadView } from "../../src/features/inbox/view-models";
import { buildInboxSnapshotFromWorkspaceSnapshot, createInboxServerActionFactory } from "../../src/features/inbox/server-boundary";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const ctx = { workspaceId: "ws_1", role: "DISPATCHER", userId: "dispatcher" } as const;
const meta = { idempotencyKey: "idem_1", now: "2026-10-04T06:30:00.000Z" } as const;
const conversation = { id: "conv_1", workspaceId: "ws_1", requestId: "req_1", customerId: "cust_1", channel: "WHATSAPP", handoverActive: false, version: 7 } as const;
const otherConversation = { id: "conv_2", workspaceId: "ws_1", requestId: "req_2", customerId: "cust_2", channel: "EMAIL", handoverActive: false, version: 3 } as const;
const baseMessage = { id: "msg_1", workspaceId: "ws_1", conversationId: "conv_1", direction: "OUTBOUND", senderKind: "STAFF", body: "Checking now", deliveryState: "PROVIDER_ACCEPTED", createdAt: "2026-10-04T06:20:00.000Z" } as const;
const otherMessage = { ...baseMessage, id: "msg_other", conversationId: "conv_2", body: "Other thread" } as const;
const snapshot = { conversations: [conversation, otherConversation], messages: [baseMessage, otherMessage], requests: [{ id: "req_1", workspaceId: "ws_1", status: "QUOTED", serviceCode: "MOVE_OUT", version: 1, createdAt: "2026-10-04T06:00:00.000Z", updatedAt: "2026-10-04T06:00:00.000Z" }], quotes: [], visits: [], invoices: [] };

async function main() {
  const boundary = source("src/features/inbox/server-boundary.ts");
  assert(!boundary.includes("export interface WorkspaceSnapshot"), "Product must not shadow WorkspaceSnapshot");
  assert(!boundary.includes("customers?:"), "Product must not invent customer records");
  assert(boundary.includes("import type { ActorContext, CommandMeta"), "shared ActorContext/CommandMeta required");
  assert(boundary.includes("from \"@/server/core/facade\""), "frozen Core facade type import required");
  assert(boundary.includes("readWorkspaceSnapshot(ctx: ActorContext, query: WorkspaceSnapshotQuery)"), "read signature must match Core");
  assert(boundary.includes("input: ConversationHandoverInput,"), "handover input must match Core");
  assert(boundary.includes("input: ConversationReplyInput,"), "reply input must match Core");
  assert(boundary.includes("Promise<Result<ConversationReplyOutcome>>"), "reply must preserve ConversationReplyOutcome");

  assert(!source("src/features/inbox/InboxPreview.tsx").includes("sampleMessages"), "reusable inbox must be fixture-free");
  assert(source("src/features/inbox/InboxFixturePreview.tsx").includes("fixtureMessages"), "fixture wrapper must own fixtures");
  assert(source("src/features/operations/OperationalRoute.tsx").includes("data?.staff.inbox ? <InboxPreview"), "OperationalRoute must render props-driven inbox");
  for (const required of ["BusinessPanel", "CustomerPanel", "StaffPanel", "CrewPanel", "OnboardingPanel", "TourPanel", "PlatformBillingPreview", "ReportsPreview", "QualityReviewPreview", "RecoveryActionsPreview", "OwnerSettingsPreview", "PropertyRecurringPreview", "CommunicationPreferences"]) {
    assert(source("src/features/operations/OperationalRoute.tsx").includes(required), `OperationalRoute must preserve ${required}`);
  }
  for (const path of ["src/features/inbox/server-boundary.ts", "src/features/inbox/view-models.ts", "src/features/inbox/InboxPreview.tsx", "src/app/app/[workspace]/inbox/server-actions.ts"]) {
    const file = source(path);
    assert(!file.includes("repositories"), `${path} must not import Core repositories`);
    assert(!file.includes("@/server/integrations"), `${path} must not import provider adapters`);
    assert(!file.includes("stripe") && !file.includes("whatsapp") && !file.includes("google-calendar"), `${path} must not import providers`);
  }

  const thread = buildInboxThreadView({ conversation: conversation as never, messages: [baseMessage as never, { ...baseMessage, id: "msg_read", deliveryState: "READ" } as never, { ...baseMessage, id: "msg_suppressed", deliveryState: "SUPPRESSED" } as never, { ...baseMessage, id: "msg_in", direction: "INBOUND", senderKind: "CUSTOMER", deliveryState: undefined } as never], customerLabel: "Customer", requestLabel: "MOVE_OUT" });
  deepEqual(thread.messages.map((message) => message.deliveryLabel), ["Provider accepted — not proof of delivery", "Read by recipient", "Suppressed by consent/policy", "Customer message received"]);
  deepEqual(thread.messages.map((message) => message.tone), ["pending", "success", "attention", "neutral"]);

  const mapped = buildInboxSnapshotFromWorkspaceSnapshot(snapshot as never, "conv_1", ctx.workspaceId);
  equal(mapped.ok, true);
  if (mapped.ok) {
    equal(mapped.value.customerLabel, "Customer cust_1");
    equal(mapped.value.requestLabel, "MOVE_OUT · QUOTED");
    equal(mapped.value.messages.length, 1);
    equal(mapped.value.messages[0]?.id, "msg_1");
  }
  equal(buildInboxSnapshotFromWorkspaceSnapshot({ ...snapshot, conversations: [{ ...conversation, workspaceId: "other_ws" }] } as never, "conv_1", ctx.workspaceId).ok, false);
  equal(buildInboxSnapshotFromWorkspaceSnapshot({ ...snapshot, messages: [{ ...baseMessage, workspaceId: "other_ws" }] } as never, "conv_1", ctx.workspaceId).ok, false);
  equal(buildInboxSnapshotFromWorkspaceSnapshot(snapshot as never, "missing_conv", ctx.workspaceId).ok, false);

  const calls: string[] = [];
  const action = createInboxServerActionFactory({
    async readWorkspaceSnapshot(readCtx, query) { calls.push(`read:${readCtx.workspaceId}:${query.conversationId}`); return { ok: true, value: snapshot as never }; },
    async setConversationHandover(handoverCtx, conversationId, input, commandMeta) { calls.push(`handover:${handoverCtx.workspaceId}:${conversationId}:${input.active}:${input.assignedUserId ?? "none"}:${commandMeta.expectedVersion}`); return { ok: true, value: { ...conversation, handoverActive: input.active, assignedUserId: input.assignedUserId, version: (commandMeta.expectedVersion ?? 0) + 1 } as never }; },
    async enqueueConversationReply(replyCtx, conversationId, input, commandMeta) { calls.push(`reply:${replyCtx.workspaceId}:${conversationId}:${input.channel}:${input.body}:${commandMeta.expectedVersion}:${commandMeta.idempotencyKey}`); return { ok: true, value: { message: { ...baseMessage, id: "msg_reply", body: input.body } as never, outboxEventId: "outbox_1" } }; },
  });
  equal((await action.loadInbox({ ctx, query: { conversationId: "conv_1" }, selectedConversationId: "conv_1" })).ok, true);
  equal((await action.setHandover({ ctx, conversation: conversation as never, active: true, assignedUserId: "dispatcher", meta })).ok, true);
  const reply = await action.enqueueReply({ ctx, conversation: conversation as never, body: "Confirmed", channel: "WHATSAPP", meta: { ...meta, idempotencyKey: "reply_idem" } });
  equal(reply.ok, true);
  if (reply.ok) {
    equal(reply.value?.message.id, "msg_reply");
    equal(reply.value?.outboxEventId, "outbox_1");
  }
  deepEqual(calls, ["read:ws_1:conv_1", "handover:ws_1:conv_1:true:dispatcher:7", "reply:ws_1:conv_1:WHATSAPP:Confirmed:7:reply_idem"]);
  equal(conversation.handoverActive, false);

  const failed = await createInboxServerActionFactory({
    async readWorkspaceSnapshot() { return { ok: true, value: snapshot as never }; },
    async setConversationHandover() { return { ok: false, code: "VERSION_CONFLICT", message: "stale" }; },
    async enqueueConversationReply() { throw new Error("must not be used by handover failure"); },
  }).setHandover({ ctx, conversation: conversation as never, active: true, meta });
  equal(failed.ok, false);
  equal(failed.state.status, "version_conflict");
  equal(conversation.handoverActive, false);

  equal(mapProductActionError({ code: "CONVERSATION_NOT_FOUND", message: "missing" }).status, "conversation_not_found");
  equal(mapProductActionError({ code: "REPLY_VALIDATION_FAILED", message: "bad" }).status, "reply_validation_error");
  equal(mapProductActionError({ code: "RECIPIENT_CONSENT_BLOCKED", message: "blocked" }).status, "consent_blocked");
  equal(mapProductActionError({ code: "OUTBOUND_ENQUEUE_FAILED", message: "queue" }).status, "outbound_enqueue_failed");
  equal(mapProductActionError({ code: "SNAPSHOT_AUTHORIZATION_FAILED", message: "auth" }).status, "snapshot_auth_failed");
  equal(disabledProductMutationResult("checkout").ok, false);
  equal(disabledProductMutationResult("crewTransition").ok, false);
  console.log("runtime-outage-e05-inbox-product-boundary-harness PASS");
}

main().catch((error) => { console.error(error); process.exit(1); });
