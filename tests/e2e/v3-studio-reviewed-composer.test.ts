import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
const css = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.module.css"), "utf8");

describe("V3 human-reviewed Inbox composer handoff", () => {
  it("binds human approval to a verified inbound message and exact conversation version", () => {
    expect(route).toContain('item.direction === "INBOUND" && item.senderKind === "CUSTOMER"');
    expect(route).toContain("Boolean(latestInbound)");
    expect(route).toContain('name="sourceMessageId" value={latestInbound?.id ?? ""}');
    expect(route).toContain('name="expectedVersion" value={selected.version}');
    expect(route).toContain('name="confirmedByStaff" value="yes" required disabled={!replySupported}');
    expect(route).toContain('formData.get("confirmedByStaff") !== "yes"');
    expect(route).toContain('confirmedByStaff: true,');
  });

  it("replays the same approved submit key instead of generating one key per POST", () => {
    expect(route).toContain('const replyApprovalKey = "staff-reply-" + randomUUID()');
    expect(route).toContain('name="idempotencyKey" value={replyApprovalKey}');
    expect(route).toContain('idempotencyKey: String(formData.get("idempotencyKey") ?? "")');
    expect(route).toContain("queueApprovedInboxReply({");
    expect(route).not.toContain("enqueueInboxReply(workspaceSlug, conversationId, body)");
    expect(route).toContain("EXISTING_REPLY");
    expect(route).toContain("Provider delivery is not yet confirmed");
  });

  it("keeps reviewer confirmation accessible and available only for supported threads", () => {
    expect(route).toContain("I reviewed this reply and approve queueing it for delivery.");
    expect(route).toContain("Await a customer message before replying");
    expect(route).toContain('disabled={!replySupported}');
    expect(css).toContain(".replyReviewConfirm");
    expect(css).toContain(".replyReviewConfirm input:focus-visible");
  });
});
