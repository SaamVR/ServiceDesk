import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mapProductActionError,
  successProductActionState,
} from "../../src/features/operations/action-state";
import {
  createScheduleServerActionFactory,
  createSendQuoteServerActionFactory,
} from "../../src/features/operations/server-action-adapters";
import { createBusinessEnquiryServerActionFactory } from "../../src/app/b/[slug]/enquire/server-actions";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("Product server boundary recovery", () => {
  it("keeps central fixture ownership explicit while preserving route module coverage", () => {
    const operationalRoute = source("src/features/operations/OperationalRoute.tsx");
    expect(operationalRoute).not.toContain("sample-data");
    expect(source("src/features/operations/OperationalFixtureRoute.tsx")).toContain("./sample-data");
    expect(operationalRoute).toContain("data?: OperationalRouteData");

    for (const token of [
      "PropertyRecurringPreview",
      "CommunicationPreferences",
      "InboxPreview",
      "ReportsPreview",
      "PlatformBillingPreview",
      "QualityReviewPreview",
      "RecoveryActionsPreview",
      "OwnerSettingsPreview",
      "OnboardingReadiness",
      "ConnectorOperationsPreview",
      "TourPanel",
    ]) {
      expect(operationalRoute, token).toContain(token);
    }

    for (const path of [
      "src/app/b/[slug]/page.tsx",
      "src/app/b/[slug]/enquire/page.tsx",
      "src/app/b/[slug]/book/page.tsx",
      "src/app/portal/page.tsx",
      "src/app/portal/properties/page.tsx",
      "src/app/portal/preferences/page.tsx",
      "src/app/app/[workspace]/inbox/page.tsx",
      "src/app/app/[workspace]/reports/page.tsx",
      "src/app/app/[workspace]/billing/page.tsx",
      "src/app/app/[workspace]/quality/page.tsx",
      "src/app/app/[workspace]/automations/page.tsx",
      "src/app/app/[workspace]/settings/page.tsx",
      "src/app/app/[workspace]/jobs/page.tsx",
      "src/app/onboarding/page.tsx",
      "src/app/tour/page.tsx",
    ]) {
      expect(source(path), path).toContain("OperationalFixtureRoute");
      expect(source(path), path).not.toContain('OperationalRoute"');
    }
  });

  it("keeps Product action factories away from Core repositories and provider adapters", () => {
    for (const path of [
      "src/app/b/[slug]/enquire/server-actions.ts",
      "src/features/operations/action-state.ts",
      "src/features/operations/server-action-adapters.ts",
      "src/features/operations/server-wiring-map.ts",
    ]) {
      const file = source(path);
      expect(file, path).not.toContain("@/server/core");
      expect(file, path).not.toContain("src/server/core");
      expect(file, path).not.toContain("Repository");
      expect(file, path).not.toContain("@/server/integrations");
      expect(file, path).not.toContain("stripe");
      expect(file, path).not.toContain("whatsapp");
      expect(file, path).not.toContain("google-calendar");
    }
  });

  it("maps server outcomes into stable Product action states", () => {
    expect(successProductActionState().status).toBe("success");
    expect(mapProductActionError({ code: "VERSION_CONFLICT", message: "stale" }).status).toBe("version_conflict");
    expect(mapProductActionError({ code: "AUTHORIZATION_FAILED", message: "auth" }).status).toBe("auth_required");
    expect(mapProductActionError({ code: "WORKSPACE_MISMATCH", message: "workspace" }).status).toBe("workspace_denied");
    expect(mapProductActionError({ code: "VISITOR_FAILED", message: "visitor" }).status).toBe("visitor_failure");
    expect(mapProductActionError({ code: "QUOTE_NOT_FOUND", message: "quote" }).status).toBe("quote_not_found");
    expect(mapProductActionError({ code: "SLOT_UNAVAILABLE", message: "slot" }).status).toBe("slot_unavailable");
    expect(mapProductActionError({ code: "HOLD_SLOT_FAILED", message: "hold" }).status).toBe("hold_failed");
    expect(mapProductActionError({ code: "ANYTHING_ELSE", message: "server" }).status).toBe("server_error");
  });

  it("orchestrates enquiry as createRequest -> updateRequest -> calculateQuote and stops on failure", async () => {
    const calls: string[] = [];
    const action = createBusinessEnquiryServerActionFactory({
      async createRequest() {
        calls.push("createRequest");
        return { ok: true, value: { id: "req_1", version: 1 } as never };
      },
      async updateRequest(input) {
        calls.push(`updateRequest:${input.requestId}:${input.expectedVersion}`);
        return { ok: true, value: { id: "req_1", version: 2 } as never };
      },
      async calculateQuote(input) {
        calls.push(`calculateQuote:${input.requestId}:${input.requestVersion}`);
        return { ok: true, value: { id: "quote_1", version: 1 } as never };
      },
    });

    const result = await action({
      context: { workspaceId: "ws", actorId: "actor", idempotencyKey: "idem" },
      request: {},
      patch: {},
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual(["createRequest", "updateRequest:req_1:1", "calculateQuote:req_1:2"]);

    const blockedCalls: string[] = [];
    const conflict = { code: "VERSION_CONFLICT", message: "stale" };
    const blocked = await createBusinessEnquiryServerActionFactory({
      async createRequest() {
        blockedCalls.push("createRequest");
        return { ok: true, value: { id: "req_1", version: 1 } as never };
      },
      async updateRequest() {
        blockedCalls.push("updateRequest");
        return { ok: false, error: conflict };
      },
      async calculateQuote() {
        blockedCalls.push("calculateQuote");
        throw new Error("calculateQuote must not run after update failure");
      },
    })({
      context: { workspaceId: "ws", actorId: "actor", idempotencyKey: "idem2" },
      request: {},
      patch: {},
    });

    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBe(conflict);
    expect(blocked.failedStep).toBe("updateRequest");
    expect(blockedCalls).toEqual(["createRequest", "updateRequest"]);
  });

  it("delegates quote and schedule actions exactly once and leaves checkout/crew disabled", async () => {
    let sendQuoteCount = 0;
    const quote = await createSendQuoteServerActionFactory({
      async sendQuote() {
        sendQuoteCount += 1;
        return { ok: true, value: { id: "quote_1", version: 2 } as never };
      },
    })({
      context: { workspaceId: "ws", actorId: "actor", idempotencyKey: "idem3" },
      quoteId: "quote_1",
      expectedVersion: 2,
    });
    expect(quote.ok).toBe(true);
    expect(sendQuoteCount).toBe(1);

    let findSlotsCount = 0;
    let holdSlotCount = 0;
    const schedule = createScheduleServerActionFactory({
      async findSlots() {
        findSlotsCount += 1;
        return { ok: true, value: [] };
      },
      async holdSlot() {
        holdSlotCount += 1;
        return { ok: false, error: { code: "HOLD_FAILED", message: "hold failed" } };
      },
    });

    await schedule.findSlots({
      context: { workspaceId: "ws", actorId: "actor", idempotencyKey: "idem4" },
      requestId: "req_1",
      quoteId: "quote_1",
    });
    const held = await schedule.holdSlot({
      context: { workspaceId: "ws", actorId: "actor", idempotencyKey: "idem5" },
      slotId: "slot_1",
      requestId: "req_1",
      quoteId: "quote_1",
      expectedQuoteVersion: 2,
    });

    expect(findSlotsCount).toBe(1);
    expect(holdSlotCount).toBe(1);
    expect(held.state.status).toBe("hold_failed");

    const wiring = source("src/features/operations/server-wiring-map.ts");
    expect(wiring).toContain('route: "checkout"');
    expect(wiring).toContain('command: "future E03 payment bridge"');
    expect(wiring).toContain('route: "crew"');
    expect(wiring).toContain('command: "transitionVisit"');
    expect((wiring.match(/enabledInProduct: false/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });
});
