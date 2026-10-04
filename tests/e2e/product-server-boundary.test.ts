import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mapProductActionError } from "../../src/features/operations/action-state";
import { createEnquiryServerActionFactory, createScheduleServerActionFactory, createSendQuoteServerActionFactory } from "../../src/features/operations/server-action-adapters";

const root = process.cwd();
function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("central Product server boundary", () => {
  it("keeps OperationalRoute fixture-free and demo routes on explicit wrapper", () => {
    expect(source("src/features/operations/OperationalRoute.tsx")).not.toContain("sample-data");
    expect(source("src/features/operations/OperationalFixtureRoute.tsx")).toContain("sample-data");
    expect(source("src/features/operations/OperationalRoute.tsx")).toContain("data?: OperationalRouteData");

    for (const path of [
      "src/app/b/[slug]/page.tsx",
      "src/app/b/[slug]/enquire/page.tsx",
      "src/app/b/[slug]/book/page.tsx",
      "src/app/portal/page.tsx",
      "src/app/app/[workspace]/quotes/page.tsx",
      "src/app/app/[workspace]/schedule/page.tsx",
      "src/app/crew/today/page.tsx",
      "src/app/crew/jobs/[id]/page.tsx",
      "src/app/onboarding/page.tsx",
      "src/app/tour/page.tsx",
    ]) {
      expect(source(path), path).toContain("OperationalFixtureRoute");
      expect(source(path), path).not.toContain("OperationalRoute\"");
    }
  });

  it("keeps Product boundary files away from Core repos and providers", () => {
    for (const path of [
      "src/features/operations/OperationalRoute.tsx",
      "src/features/operations/action-state.ts",
      "src/features/operations/server-action-adapters.ts",
      "src/features/operations/server-wiring-map.ts",
    ]) {
      const file = source(path);
      expect(file, path).not.toContain("@/server/core");
      expect(file, path).not.toContain("src/server/core");
      expect(file, path).not.toContain("@/server/integrations");
      expect(file, path).not.toContain("stripe");
      expect(file, path).not.toContain("whatsapp");
      expect(file, path).not.toContain("google-calendar");
    }
  });

  it("maps server errors into stable Product action state", () => {
    expect(mapProductActionError({ code: "VERSION_CONFLICT", message: "stale" }).status).toBe("version_conflict");
    expect(mapProductActionError({ code: "AUTH_REQUIRED", message: "login" }).status).toBe("auth_required");
    expect(mapProductActionError({ code: "WORKSPACE_DENIED", message: "workspace" }).status).toBe("workspace_denied");
    expect(mapProductActionError({ code: "SLOT_UNAVAILABLE", message: "slot" }).status).toBe("slot_unavailable");
    expect(mapProductActionError({ code: "HOLD_FAILED", message: "hold" }).status).toBe("hold_failed");
  });

  it("orchestrates enquiry through injected commands without local quote math", async () => {
    const calls: string[] = [];
    const action = createEnquiryServerActionFactory({
      async createRequest() { calls.push("createRequest"); return { ok: true, value: { id: "req_1", version: 1 } as never }; },
      async updateRequest(input) { calls.push(`updateRequest:${input.requestId}:${input.expectedVersion}`); return { ok: true, value: { id: "req_1", version: 2 } as never }; },
      async calculateQuote(input) { calls.push(`calculateQuote:${input.requestId}:${input.requestVersion}`); return { ok: true, value: { id: "quote_1", version: 1 } as never }; },
    });

    const result = await action({ context: { workspaceId: "ws", actorId: "user", idempotencyKey: "idem" }, request: {}, patch: {} });
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["createRequest", "updateRequest:req_1:1", "calculateQuote:req_1:2"]);
    expect(source("src/features/operations/server-action-adapters.ts")).not.toContain("calculatePrice");
    expect(source("src/features/operations/server-action-adapters.ts")).not.toContain("pricing");
  });

  it("propagates failures exactly and keeps schedule/quote dependency-injected", async () => {
    const error = { code: "VERSION_CONFLICT", message: "stale version" };
    const failed = await createEnquiryServerActionFactory({
      async createRequest() { return { ok: true, value: { id: "req_1", version: 1 } as never }; },
      async updateRequest() { return { ok: false, error }; },
      async calculateQuote() { throw new Error("must not run"); },
    })({ context: { workspaceId: "ws", actorId: "user", idempotencyKey: "idem2" }, request: {}, patch: {} });
    expect(failed.ok).toBe(false);
    expect(failed.error).toBe(error);
    expect(failed.failedStep).toBe("updateRequest");

    const quote = await createSendQuoteServerActionFactory({ async sendQuote() { return { ok: false, error: { code: "AUTH_REQUIRED", message: "login" } }; } })({ context: { workspaceId: "ws", actorId: "user", idempotencyKey: "idem3" }, quoteId: "quote", expectedVersion: 1 });
    expect(quote.state.status).toBe("auth_required");

    const schedule = createScheduleServerActionFactory({
      async findSlots() { return { ok: true, value: [] }; },
      async holdSlot() { return { ok: false, error: { code: "HOLD_FAILED", message: "expired" } }; },
    });
    expect((await schedule.findSlots({ context: { workspaceId: "ws", actorId: "user", idempotencyKey: "idem4" }, requestId: "req", quoteId: "quote" })).ok).toBe(true);
    expect((await schedule.holdSlot({ context: { workspaceId: "ws", actorId: "user", idempotencyKey: "idem5" }, slotId: "slot", requestId: "req", quoteId: "quote", expectedQuoteVersion: 1 })).state.status).toBe("hold_failed");
  });
});
