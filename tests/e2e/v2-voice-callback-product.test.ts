import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 missed-call callback product lifecycle", () => {
  it("maps callback intake/state into the staff request snapshot", () => {
    const runtime = source("src/features/operations/operational-product-runtime.ts");
    expect(runtime).toContain("callbackIntakeId?: string");
    expect(runtime).toContain('callbackState?: "PENDING" | "RESOLVED"');
    expect(runtime).toContain('callbackIntakeId: textValue(structured, "voiceCallIntakeId")');
    expect(runtime).toContain('structured.callbackState === "RESOLVED"');
  });

  it("uses the authoritative callback command from the staff runtime", () => {
    const runtime = source("src/features/operations/operational-product-runtime.ts");
    expect(runtime).toContain("setOperationalVoiceCallbackState");
    expect(runtime).toContain("createPostgresVoiceMissedCallCommandPort");
    expect(runtime).toContain(".setVoiceCallbackState(resolved.value.actor");
  });

  it("lets staff complete and reopen callbacks from the real Requests workspace", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain("Mark callback complete");
    expect(route).toContain("Reopen callback");
    expect(route).toContain("Completing the callback resolves its operations attention item.");
    expect(route).toContain("Reopening the callback puts the request back in the attention queue.");
    expect(route).toContain("setOperationalVoiceCallbackState");
  });

  it("shows missed-call labels consistently in the request queue and detail", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route.match(/requestDisplayLabel\(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(route).toContain("Anonymous caller · callback completed");
  });
});
