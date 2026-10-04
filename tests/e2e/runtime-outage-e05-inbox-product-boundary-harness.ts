import { deepEqual, equal, ok as assert } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mapProductActionError } from "../../src/features/operations/action-state";
import { disabledProductMutationResult } from "../../src/features/operations/server-action-adapters";
import { buildInboxThreadView } from "../../src/features/inbox/view-models";
import { buildInboxSnapshotFromWorkspaceSnapshot, createInboxServerActionFactory } from "../../src/features/inbox/server-boundary";

const root = process.cwd();
const context = { workspaceId: "ws_1", actorId: "dispatcher", idempotencyKey: "idem_1" };
const conversation = { id: "conv_1", workspaceId: "ws_1", requestId: "req_1", customerId: "cust_1", channel: "WHATSAPP", handoverActive: false, version: 7 } as const;
const baseMessage = { id: "msg_1", workspaceId: "ws_1", conversationId: "conv_1", direction: "OUTBOUND", senderKind: "STAFF", body: "Checking now", deliveryState: "PROVIDER_ACCEPTED", createdAt: "2026-10-04T06:20:00.000Z" } as const;

function source(path: string) { return readFileSync(join(root, path), "utf8"); }

async function main() {
  assert(!source("src/features/inbox/InboxPreview.tsx").includes("sampleMessages"), "reusable InboxPreview must not own local sample messages");
  assert(!source("src/features/inbox/InboxPreview.tsx").includes("sampleThread"), "reusable InboxPreview must not own a local sample thread");
  assert(source("src/features/inbox/InboxFixturePreview.tsx").includes("fixtureMessages"), "InboxFixturePreview must own fixture messages");
  assert(source("src/features/operations/OperationalRoute.tsx").includes("data?.staff.inbox ? <InboxPreview"), "OperationalRoute must render props-driven inbox data");

  for (const required of ["BusinessPanel", "CustomerPanel", "StaffPanel", "CrewPanel", "OnboardingPanel", "TourPanel", "PlatformBillingPreview", "ReportsPreview", "QualityReviewPreview", "RecoveryActionsPreview", "OwnerSettingsPreview", "PropertyRecurringPreview", "CommunicationPreferences"]) {
    assert(source("src/features/operations/OperationalRoute.tsx").includes(required), `OperationalRoute must preserve ${required}`);
  }

  for (const path of ["src/features/inbox/server-boundary.ts", "src/features/inbox/view-models.ts", "src/features/inbox/InboxPreview.tsx", "src/features/operations/OperationalRoute.tsx", "src/app/app/[workspace]/inbox/server-actions.ts"]) {
    const file = source(path);
    assert(!file.includes("@/server/core"), `${path} must not import Core internals`);
    assert(!file.includes("src/server/core"), `${path} must not import Core repository paths`);
    assert(!file.includes("@/server/integrations"), `${path} must not import provider adapters`);
    assert(!file.includes("stripe"), `${path} must not import payment providers`);
    assert(!file.includes("whatsapp"), `${path} must not import WhatsApp providers`);
    assert(!file.includes("google-calendar"), `${path} must not import Calendar providers`);
  }

  const thread = buildInboxThreadView({ conversation, messages: [baseMessage as never, { ...baseMessage, id: "msg_read", deliveryState: "READ" } as never, { ...baseMessage, id: "msg_suppressed", deliveryState: "SUPPRESSED" } as never, { ...baseMessage, id: "msg_in", direction: "INBOUND", senderKind: "CUSTOMER", deliveryState: undefined } as never], customerLabel: "Customer", requestLabel: "MOVE_OUT" });
  deepEqual(thread.messages.map((message) => message.deliveryLabel), ["Provider accepted — not proof of delivery", "Read by recipient", "Suppressed by consent/policy", "Customer message received"]);
  deepEqual(thread.messages.map((message) => message.tone), ["pending", "success", "attention", "neutral"]);

  const snapshot = { workspaceId: "ws_1", conversations: [conversation], messages: [baseMessage], requests: [{ id: "req_1", workspaceId: "ws_1", status: "QUOTED", serviceCode: "MOVE_OUT", version: 1, createdAt: "2026-10-04T06:00:00.000Z", updatedAt: "2026-10-04T06:00:00.000Z" }], customers: [{ id: "cust_1", displayName: "Sample Customer" }] };
  const mapped = buildInboxSnapshotFromWorkspaceSnapshot(snapshot as never, "conv_1");
  equal(mapped.ok, true);
  if (mapped.ok) { equal(mapped.value.customerLabel, "Sample Customer"); equal(mapped.value.requestLabel, "MOVE_OUT · QUOTED"); }
  equal(buildInboxSnapshotFromWorkspaceSnapshot({ ...snapshot, conversations: [{ ...conversation, workspaceId: "other_ws" }] } as never, "conv_1").ok, false);
  equal(buildInboxSnapshotFromWorkspaceSnapshot({ ...snapshot, messages: [{ ...baseMessage, conversationId: "other_conv" }] } as never, "conv_1").ok, false);
  equal(buildInboxSnapshotFromWorkspaceSnapshot({ ...snapshot, messages: [{ ...baseMessage, workspaceId: "other_ws" }] } as never, "conv_1").ok, false);

  const calls: string[] = [];
  const action = createInboxServerActionFactory({
    async readWorkspaceSnapshot(input) { calls.push(`read:${input.workspaceId}`); return { ok: true, value: snapshot as never }; },
    async setConversationHandover(input) { calls.push(`handover:${input.conversationId}:${input.expectedVersion}:${input.handoverActive}`); return { ok: true, value: { ...conversation, handoverActive: input.handoverActive, version: input.expectedVersion + 1 } as never }; },
    async enqueueConversationReply(input) { calls.push(`reply:${input.conversationId}:${input.expectedVersion}:${input.body}`); return { ok: true, value: { ...baseMessage, id: "msg_reply", body: input.body } as never }; },
  });
  equal((await action.loadInbox({ context, workspaceId: "ws_1", selectedConversationId: "conv_1" })).ok, true);
  equal((await action.setHandover({ context, conversation: conversation as never, handoverActive: true })).ok, true);
  equal((await action.enqueueReply({ context, conversation: conversation as never, body: "Confirmed" })).ok, true);
  deepEqual(calls, ["read:ws_1", "handover:conv_1:7:true", "reply:conv_1:7:Confirmed"]);

  const failed = await createInboxServerActionFactory({
    async readWorkspaceSnapshot() { return { ok: true, value: snapshot as never }; },
    async setConversationHandover() { return { ok: false, error: { code: "VERSION_CONFLICT", message: "stale" } }; },
    async enqueueConversationReply() { throw new Error("must not be used by handover failure"); },
  }).setHandover({ context, conversation: conversation as never, handoverActive: true });
  equal(failed.ok, false);
  equal(failed.state.status, "version_conflict");

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
