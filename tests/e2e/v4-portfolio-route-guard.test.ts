import { describe, expect, it } from "vitest";
import { portfolioAllowsRequest } from "@/features/product/portfolio-route-policy";

describe("portfolio-only HTTP entry boundary", () => {
  it("keeps the homepage, case study, product tour and sandbox readable", () => {
    for (const path of [
      "/", "/work/business-automation", "/work/business-automation/",
      "/sandbox", "/demo", "/tour", "/features", "/use-cases/cleaning",
      "/integrations", "/pricing", "/contact", "/help", "/privacy",
      "/terms", "/presentation", "/health",
    ]) {
      expect(portfolioAllowsRequest("GET", path), path).toBe(true);
      expect(portfolioAllowsRequest("HEAD", path), path).toBe(true);
    }
  });

  it("rejects all mutating verbs, even on otherwise public pages", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      for (const path of ["/", "/sandbox", "/demo", "/health", "/contact"]) {
        expect(portfolioAllowsRequest(method, path), method + " " + path).toBe(false);
      }
    }
  });

  it("refuses authentication, tenancy, billing, provider and API routes", () => {
    for (const path of [
      "/auth/sign-in", "/auth/sign-up", "/auth/confirm",
      "/app/brightroom/overview", "/app/brightroom/invoices",
      "/portal", "/portal/quotes/123", "/crew/today",
      "/onboarding", "/onboarding/verified", "/b/example/book",
      "/api/internal/ai/draft", "/api/internal/inbox/reply",
      "/api/public/request-photos", "/api/providers/whatsapp",
      "/api/providers/email/inbound", "/api/governance/audit-export",
      "/health/other", "/work/not-an-approved-demo",
      "//auth/sign-in", "/sandbox/../../api",
    ]) {
      expect(portfolioAllowsRequest("GET", path), path).toBe(false);
    }
  });

  it("does not mistake suffixes or malformed strings for allowed routes", () => {
    expect(portfolioAllowsRequest("GET", "/sandbox-other")).toBe(false);
    expect(portfolioAllowsRequest("GET", "/healthz")).toBe(false);
    expect(portfolioAllowsRequest("GET", "sandbox")).toBe(false);
    expect(portfolioAllowsRequest("GET", "/sandbox\0")).toBe(false);
  });
});
