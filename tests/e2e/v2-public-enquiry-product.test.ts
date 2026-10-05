import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 public enquiry product", () => {
  it("uses the server-only deployed enquiry RPC and preserves a visitor session", () => {
    const runtime = source("src/features/operations/public-business-runtime.ts");
    expect(runtime).toContain('service.rpc("servicedesk_create_public_enquiry"');
    expect(runtime).toContain('cookieStore.get("servicedesk_visitor_session")');
    expect(runtime).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("renders a real enquiry form instead of a temporary unavailable notice", () => {
    const route = source("src/features/operations/BusinessProductRoute.tsx");
    expect(route).toContain("submitPublicEnquiry");
    expect(route).toContain("Send enquiry");
    expect(route).not.toContain("Enquiry form temporarily unavailable");
    expect(route).not.toContain("New online enquiries cannot be submitted");
  });

  it("carries a selected service from the catalog into the enquiry form", () => {
    const route = source("src/features/operations/BusinessProductRoute.tsx");
    const page = source("src/app/b/[slug]/enquire/page.tsx");
    expect(route).toContain('"?service=" + encodeURIComponent(service.code)');
    expect(route).toContain("defaultValue={selectedService}");
    expect(page).toContain("selectedServiceCode={query.service}");
  });
});
