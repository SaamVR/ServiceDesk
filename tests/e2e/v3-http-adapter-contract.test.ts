import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V3 coordinator-backed HTTP adapter contract", () => {
  const adapters = [
    { path: "src/app/api/internal/ai/draft/route.ts", handler: "handleStaffAiHttpPost", method: "POST" },
    { path: "src/app/api/internal/inbox/reply/route.ts", handler: "handleReviewedInboxReplyHttpPost", method: "POST" },
    { path: "src/app/api/internal/inbox/delivery/route.ts", handler: "handleDeliveryTriageHttpGet", method: "GET" },
  ] as const;

  for (const adapter of adapters) {
    it(adapter.path + " delegates policy to the backend without exposing an alternate route", () => {
      const source = read(adapter.path);
      expect(source).toContain('export const dynamic = "force-dynamic"');
      expect(source).toContain('export const runtime = "nodejs"');
      expect(source).toContain("export async function " + adapter.method + "(");
      expect(source).toContain("return " + adapter.handler + "(request)");
      expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(source).not.toContain("fetch(");
      expect(source).not.toContain("autoApprove");
    });
  }

  it("requires the signed provider handler for both Meta challenge and inbound POST", () => {
    const source = read("src/app/api/providers/whatsapp/route.ts");
    expect(source).toContain("handleWhatsAppHttpChallenge(request)");
    expect(source).toContain("handleWhatsAppHttpPost(request)");
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).toContain('export const runtime = "nodejs"');
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("autoApprove");
  });
});
