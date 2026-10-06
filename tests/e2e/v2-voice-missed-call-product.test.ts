import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 missed-call operational product", () => {
  it("maps callback metadata into the authorized staff request snapshot", () => {
    const runtime = source("src/features/operations/operational-product-runtime.ts");
    expect(runtime).toContain("sourceChannel?: string");
    expect(runtime).toContain("callbackRequired?: boolean");
    expect(runtime).toContain("callbackContactRef?: string");
    expect(runtime).toContain('sourceChannel: textValue(structured, "sourceChannel")');
    expect(runtime).toContain('callbackContactRef: textValue(structured, "callbackContactRef")');
  });

  it("renders missed-call leads as actionable requests without claiming a customer identity", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain('request.sourceChannel === "VOICE" ? "Missed call"');
    expect(route).toContain("Callback required");
    expect(route).toContain("Anonymous caller · staff callback required");
    expect(route).toContain("Callback contact");
    expect(route).not.toContain("Caller matched customer");
  });

  it("keeps quote calculation blocked until normal request facts exist", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("selectedRequest.serviceCode");
    expect(route).toContain("selectedRequest.bedrooms !== undefined");
    expect(route).toContain("selectedRequest.bathrooms !== undefined");
    expect(route).toContain("Complete the missing intake details before pricing.");
  });
});
