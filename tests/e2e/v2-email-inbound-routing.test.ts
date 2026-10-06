import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 inbound email core routing", () => {
  it("widens the shared inbound contract without widening email media", () => {
    const facade = source("src/server/core/facade.ts");
    const inbound = source("src/server/core/inbound-message.ts");
    expect(facade).toContain('channel: "WHATSAPP" | "EMAIL"');
    expect(facade).toContain('media?: { provider: "WHATSAPP"; providerMediaId: string }');
    expect(inbound).toContain('event.channel === "EMAIL" && event.contentKind === "MEDIA_REFERENCE"');
    expect(inbound).toContain("INBOUND_EMAIL_MEDIA_UNSUPPORTED");
  });

  it("routes email to its dedicated RPC and preserves the WhatsApp RPC", () => {
    const postgres = source("src/server/core/conversation-postgres.ts");
    expect(postgres).toContain('event.channel === "EMAIL"');
    expect(postgres).toContain('"servicedesk_apply_inbound_email_message"');
    expect(postgres).toContain('"servicedesk_apply_inbound_message"');
  });

  it("uses channel-specific contact identity and stable normalized email threads", () => {
    const inbound = source("src/server/core/inbound-message.ts");
    const domain = source("src/domain/conversations.ts");
    expect(inbound).toContain('event.channel === "EMAIL" ? "EMAIL" : "WHATSAPP"');
    expect(domain).toContain('provider: "WHATSAPP" | "EMAIL"');
    expect(domain).toContain('provider === "EMAIL" ? senderRef.trim().toLowerCase() : senderRef.trim()');
  });
});
