import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"),
  "utf8",
);

describe("V2 Inbox identity and channel history safety", () => {
  it("labels unresolved senders explicitly instead of calling them customers", () => {
    expect(route).toContain('"Unverified sender"');
    expect(route).toContain('title="Identity review required"');
    expect(route).toContain("This sender is not attached to exactly one verified customer contact.");
  });

  it("disables replies until an inbound sender is linked to a verified customer", () => {
    expect(route).toContain('&& Boolean(customer)');
    expect(route).toContain("Verify and link this sender before replying");
    expect(route).toContain("Identity must be verified before reply");
  });

  it("links only conversations that share the exact selected customer id", () => {
    expect(route).toContain("conversation.customerId === customer.id");
    expect(route).toContain("conversation.id !== selected.id");
    expect(route).toContain("Other channels");
  });

  it("does not merge conversations by display name, sender label, or channel", () => {
    expect(route).not.toMatch(/conversation\.customerId\s*===\s*customer\.displayName/);
    expect(route).not.toMatch(/conversation\.channel\s*===\s*selected\.channel.*relatedConversations/);
  });
});
