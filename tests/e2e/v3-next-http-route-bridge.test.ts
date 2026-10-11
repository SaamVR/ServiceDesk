import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = (path: string) => readFileSync(join(process.cwd(), "src/app/api", path, "route.ts"), "utf8");

describe("V3 thin HTTP route adapters on accepted backend", () => {
  const routes = [
    { path: "providers/whatsapp", handler: "provider-whatsapp-http", methods: ["GET", "POST"],
      delegates: ["handleWhatsAppHttpChallenge", "handleWhatsAppHttpPost"] },
    { path: "internal/ai/draft", handler: "ai-staff-http", methods: ["POST"],
      delegates: ["handleStaffAiHttpPost"] },
    { path: "internal/inbox/reply", handler: "reviewed-inbox-reply-http", methods: ["POST"],
      delegates: ["handleReviewedInboxReplyHttpPost"] },
    { path: "internal/inbox/delivery", handler: "delivery-triage-http", methods: ["GET"],
      delegates: ["handleDeliveryTriageHttpGet"] },
  ];

  it("uses dynamic Node route handlers and delegates all authority to server-only HTTP boundaries", () => {
    for (const entry of routes) {
      const source = route(entry.path);
      expect(source, entry.path).toContain('from "@/server/api-handlers/' + entry.handler + '"');
      expect(source, entry.path).toContain('export const dynamic = "force-dynamic"');
      expect(source, entry.path).toContain('export const runtime = "nodejs"');
      for (const method of entry.methods) {
        expect(source, entry.path).toContain("export " + (method === "POST" ? "async " : method === "GET" && entry.path !== "providers/whatsapp" ? "async " : "") + "function " + method + "(request: Request)");
      }
      for (const delegate of entry.delegates) {
        expect(source, entry.path).toContain("return " + delegate + "(request)");
      }
      expect(source, entry.path).not.toContain("createClient(");
      expect(source, entry.path).not.toContain("process.env");
      expect(source, entry.path).not.toContain("fetch(");
    }
  });

  it("exposes only the method each internal surface needs; no GET can approve an outbound reply", () => {
    for (const path of ["internal/ai/draft", "internal/inbox/reply"]) {
      const source = route(path);
      expect(source).not.toMatch(/export (?:async )?function GET\(/);
    }
    expect(route("internal/inbox/delivery")).not.toMatch(/export (?:async )?function POST\(/);
    const inbound = route("providers/whatsapp");
    expect(inbound).toContain("handleWhatsAppHttpChallenge");
    expect(inbound).toContain("handleWhatsAppHttpPost");
    expect(inbound).not.toContain("SERVICEDESK_WHATSAPP_DURABLE_STATUS_ENABLED");
  });
});
