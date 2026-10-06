import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 professional shared inbox UI", () => {
  it("presents conversations as a triage workspace rather than generic cards", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("inboxWorkspace");
    expect(route).toContain("conversationItem");
    expect(route).toContain("messageBubble");
    expect(route).toContain("Customer context");
    expect(route).toContain("Queue reply");
  });

  it("preserves authoritative handover and reply server actions", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("toggleInboxHandover");
    expect(route).toContain("enqueueInboxReply");
    expect(route).toContain("conversationId");
    expect(route).toContain("deliveryState");
  });

  it("keeps channel support and stored delivery truth explicit", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    const inboxStart = route.indexOf("function InboxView");
    const inboxEnd = route.indexOf("\nfunction CustomersView", inboxStart);
    const inbox = route.slice(inboxStart, inboxEnd);

    expect(inboxStart).toBeGreaterThanOrEqual(0);
    expect(inboxEnd).toBeGreaterThan(inboxStart);
    expect(inbox).toContain('selected.channel === "WHATSAPP" || selected.channel === "EMAIL"');
    expect(inbox).toContain("Stored per message");
    expect(inbox).not.toContain("Fake unread");
    expect(inbox).not.toContain("Provider verified");
  });

  it("provides responsive triage layout contracts", () => {
    const css = source("src/features/operations/OperationalProductRoute.module.css");
    expect(css).toContain("grid-template-columns: 280px minmax(420px, 1fr) 290px");
    expect(css).toContain("@media (max-width: 1180px)");
    expect(css).toContain("@media (max-width: 760px)");
  });
});
