import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mapProductActionError } from "../../src/features/operations/action-state";
import { buildInboxThreadView } from "../../src/features/inbox/view-models";
import { buildInboxSnapshotFromWorkspaceSnapshot, createInboxServerActionFactory } from "../../src/features/inbox/server-boundary";

const root = process.cwd();
function source(path: string) { return readFileSync(join(root, path), "utf8"); }

describe("E05 Product inbox server boundary", () => {
  const conversation = { id: "conv_1", workspaceId: "ws_1", requestId: "req_1", customerId: "cust_1", channel: "WHATSAPP", handoverActive: false, version: 7 } as never;
  const message = { id: "msg_1", workspaceId: "ws_1", conversationId: "conv_1", direction: "OUTBOUND", senderKind: "STAFF", body: "Checking now", deliveryState: "PROVIDER_ACCEPTED", createdAt: "2026-10-04T06:20:00.000Z" } as never;
  const snapshot = { workspaceId: "ws_1", conversations: [conversation], messages: [message], requests: [{ id: "req_1", workspaceId: "ws_1", status: "QUOTED", serviceCode: "MOVE_OUT", version: 1, createdAt: "2026-10-04T06:00:00.000Z", updatedAt: "2026-10-04T06:00:00.000Z" }], customers: [{ id: "cust_1", displayName: "Sample Customer" }] } as never;
  const context = { workspaceId: "ws_1", actorId: "dispatcher", idempotencyKey: "idem" };

  it("keeps reusable inbox fixture-free and route data driven", () => {
    expect(source("src/features/inbox/InboxPreview.tsx")).not.toContain("sampleMessages");
    expect(source("src/features/inbox/InboxPreview.tsx")).not.toContain("sampleThread");
    expect(source("src/features/inbox/InboxFixturePreview.tsx")).toContain("fixtureMessages");
    expect(source("src/features/operations/OperationalRoute.tsx")).toContain("data?.staff.inbox ? <InboxPreview");
  });

  it("maps durable delivery states truthfully", () => {
    const view = buildInboxThreadView({ conversation, messages: [message, { ...message, id: "msg_read", deliveryState: "READ" }, { ...message, id: "msg_failed", deliveryState: "FAILED" }, { ...message, id: "msg_suppressed", deliveryState: "SUPPRESSED" }], customerLabel: "Customer", requestLabel: "MOVE_OUT" });
    expect(view.messages.map((item) => item.deliveryLabel)).toEqual(["Provider accepted — not proof of delivery", "Read by recipient", "Failed — staff recovery required", "Suppressed by consent/policy"]);
    expect(view.messages.map((item) => item.tone)).toEqual(["pending", "success", "failure", "attention"]);
  });

  it("fails closed for cross-workspace and mismatched message snapshots", () => {
    expect(buildInboxSnapshotFromWorkspaceSnapshot(snapshot, "conv_1").ok).toBe(true);
    expect(buildInboxSnapshotFromWorkspaceSnapshot({ ...snapshot, conversations: [{ ...(conversation as object), workspaceId: "other_ws" }] } as never, "conv_1").ok).toBe(false);
    expect(buildInboxSnapshotFromWorkspaceSnapshot({ ...snapshot, messages: [{ ...(message as object), conversationId: "other_conv" }] } as never, "conv_1").ok).toBe(false);
    expect(buildInboxSnapshotFromWorkspaceSnapshot({ ...snapshot, messages: [{ ...(message as object), workspaceId: "other_ws" }] } as never, "conv_1").ok).toBe(false);
  });

  it("delegates E05 actions without optimistic local mutation", async () => {
    const calls: string[] = [];
    const action = createInboxServerActionFactory({
      async readWorkspaceSnapshot(input) { calls.push(`read:${input.workspaceId}`); return { ok: true, value: snapshot }; },
      async setConversationHandover(input) { calls.push(`handover:${input.conversationId}:${input.expectedVersion}:${input.handoverActive}`); return { ok: true, value: { ...(conversation as object), handoverActive: input.handoverActive, version: input.expectedVersion + 1 } as never }; },
      async enqueueConversationReply(input) { calls.push(`reply:${input.conversationId}:${input.expectedVersion}:${input.body}`); return { ok: true, value: { ...(message as object), id: "msg_reply", body: input.body } as never }; },
    });
    expect((await action.loadInbox({ context, workspaceId: "ws_1", selectedConversationId: "conv_1" })).ok).toBe(true);
    expect((await action.setHandover({ context, conversation, handoverActive: true })).ok).toBe(true);
    expect((await action.enqueueReply({ context, conversation, body: "Confirmed" })).ok).toBe(true);
    expect(calls).toEqual(["read:ws_1", "handover:conv_1:7:true", "reply:conv_1:7:Confirmed"]);
  });

  it("maps E05 action failures to stable Product action states", () => {
    expect(mapProductActionError({ code: "CONVERSATION_NOT_FOUND", message: "missing" }).status).toBe("conversation_not_found");
    expect(mapProductActionError({ code: "REPLY_VALIDATION_FAILED", message: "bad" }).status).toBe("reply_validation_error");
    expect(mapProductActionError({ code: "RECIPIENT_CONSENT_BLOCKED", message: "blocked" }).status).toBe("consent_blocked");
    expect(mapProductActionError({ code: "OUTBOUND_ENQUEUE_FAILED", message: "queue" }).status).toBe("outbound_enqueue_failed");
    expect(mapProductActionError({ code: "SNAPSHOT_AUTHORIZATION_FAILED", message: "auth" }).status).toBe("snapshot_auth_failed");
  });

  it("keeps Product inbox boundary away from providers and Core repositories", () => {
    for (const path of ["src/features/inbox/server-boundary.ts", "src/features/inbox/view-models.ts", "src/features/inbox/InboxPreview.tsx", "src/app/app/[workspace]/inbox/server-actions.ts"]) {
      const file = source(path);
      expect(file, path).not.toContain("@/server/core");
      expect(file, path).not.toContain("src/server/core");
      expect(file, path).not.toContain("@/server/integrations");
      expect(file, path).not.toContain("stripe");
      expect(file, path).not.toContain("whatsapp");
      expect(file, path).not.toContain("google-calendar");
    }
  });
});
