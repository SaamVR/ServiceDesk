import { deepEqual, equal, ok as assert } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mapProductActionError,
  successProductActionState,
} from "../../src/features/operations/action-state";
import {
  createEnquiryServerActionFactory,
  createScheduleServerActionFactory,
  createSendQuoteServerActionFactory,
} from "../../src/features/operations/server-action-adapters";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function assertBoundaryClean(path: string) {
  const file = source(path);
  assert(!file.includes("@/server/core"), `${path} must not import Core internals`);
  assert(!file.includes("src/server/core"), `${path} must not import Core repository paths`);
  assert(!file.includes("Repository"), `${path} must not import Core repositories`);
  assert(!file.includes("@/server/integrations"), `${path} must not import provider adapters`);
  assert(!file.includes("stripe"), `${path} must not call payment providers`);
  assert(!file.includes("whatsapp"), `${path} must not call messaging providers`);
  assert(!file.includes("google-calendar"), `${path} must not call calendar providers`);
}

async function main() {
  const operationalRoute = source("src/features/operations/OperationalRoute.tsx");
  const fixtureRoute = source("src/features/operations/OperationalFixtureRoute.tsx");
  const wiring = source("src/features/operations/server-wiring-map.ts");

  assert(!operationalRoute.includes("sample-data"), "OperationalRoute must not import central sample data");
  assert(fixtureRoute.includes("./sample-data"), "OperationalFixtureRoute must own central sample data");
  assert(operationalRoute.includes("data?: OperationalRouteData"), "OperationalRoute must accept typed route data");

  for (const token of [
    "BusinessPanel",
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
    "CrewJobPreview",
  ]) {
    assert(operationalRoute.includes(token), `OperationalRoute must keep ${token} represented`);
  }

  for (const routeToken of [
    'route: "enquiry"',
    'route: "quote"',
    'route: "schedule"',
    'route: "checkout"',
    'route: "portal"',
    'route: "crew"',
    '"/b/[slug]/enquire"',
    '"/portal/properties"',
    '"/portal/preferences"',
    '"/app/[workspace]/reports"',
    '"/app/[workspace]/billing"',
    '"/crew/today"',
  ]) {
    assert(wiring.includes(routeToken), `server-wiring-map must represent ${routeToken}`);
  }

  for (const path of [
    "src/app/b/[slug]/enquire/server-actions.ts",
    "src/features/operations/action-state.ts",
    "src/features/operations/server-action-adapters.ts",
    "src/features/operations/server-wiring-map.ts",
  ]) {
    assertBoundaryClean(path);
  }

  const routeAction = source("src/app/b/[slug]/enquire/server-actions.ts");
  assert(routeAction.includes("createBusinessEnquiryServerActionFactory"), "business enquiry route must expose a dependency-injected factory");
  assert(routeAction.includes("EnquiryCommandPort"), "business enquiry route must inject accepted command port");

  equal(successProductActionState().status, "success");
  equal(mapProductActionError({ code: "VERSION_CONFLICT", message: "stale" }).status, "version_conflict");
  equal(mapProductActionError({ code: "AUTHORIZATION_FAILED", message: "auth" }).status, "auth_required");
  equal(mapProductActionError({ code: "WORKSPACE_MISMATCH", message: "workspace" }).status, "workspace_denied");
  equal(mapProductActionError({ code: "VISITOR_FAILED", message: "visitor" }).status, "visitor_failure");
  equal(mapProductActionError({ code: "QUOTE_NOT_FOUND", message: "quote" }).status, "quote_not_found");
  equal(mapProductActionError({ code: "SLOT_UNAVAILABLE", message: "slot" }).status, "slot_unavailable");
  equal(mapProductActionError({ code: "HOLD_SLOT_FAILED", message: "hold" }).status, "hold_failed");
  equal(mapProductActionError({ code: "SOMETHING_ELSE", message: "server" }).status, "server_error");

  const calls: string[] = [];
  const enquiry = createEnquiryServerActionFactory({
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

  const result = await enquiry({
    context: { workspaceId: "ws", actorId: "actor", idempotencyKey: "idem" },
    request: { serviceCode: "MOVE_OUT" },
    patch: { bedrooms: 3 },
  });
  equal(result.ok, true);
  deepEqual(calls, ["createRequest", "updateRequest:req_1:1", "calculateQuote:req_1:2"]);

  const blockedCalls: string[] = [];
  const conflict = { code: "VERSION_CONFLICT", message: "stale version" };
  const blocked = await createEnquiryServerActionFactory({
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
  equal(blocked.ok, false);
  equal(blocked.error, conflict);
  equal(blocked.failedStep, "updateRequest");
  deepEqual(blockedCalls, ["createRequest", "updateRequest"]);

  let sendQuoteCount = 0;
  const sent = await createSendQuoteServerActionFactory({
    async sendQuote(input) {
      sendQuoteCount += 1;
      equal(input.quoteId, "quote_1");
      return { ok: true, value: { id: "quote_1", version: 2 } as never };
    },
  })({
    context: { workspaceId: "ws", actorId: "actor", idempotencyKey: "idem3" },
    quoteId: "quote_1",
    expectedVersion: 2,
  });
  equal(sent.ok, true);
  equal(sendQuoteCount, 1);

  let findSlotCount = 0;
  let holdSlotCount = 0;
  const schedule = createScheduleServerActionFactory({
    async findSlots(input) {
      findSlotCount += 1;
      equal(input.requestId, "req_1");
      return { ok: true, value: [{ id: "slot_1" }] as never };
    },
    async holdSlot(input) {
      holdSlotCount += 1;
      equal(input.slotId, "slot_1");
      return { ok: false, error: { code: "HOLD_FAILED", message: "hold failed" } };
    },
  });
  equal((await schedule.findSlots({
    context: { workspaceId: "ws", actorId: "actor", idempotencyKey: "idem4" },
    requestId: "req_1",
    quoteId: "quote_1",
  })).ok, true);
  equal((await schedule.holdSlot({
    context: { workspaceId: "ws", actorId: "actor", idempotencyKey: "idem5" },
    slotId: "slot_1",
    requestId: "req_1",
    quoteId: "quote_1",
    expectedQuoteVersion: 2,
  })).state.status, "hold_failed");
  equal(findSlotCount, 1);
  equal(holdSlotCount, 1);

  assert(wiring.includes('command: "future E03 payment bridge"'), "checkout mutation must remain future-gated");
  assert(wiring.includes('command: "transitionVisit"'), "crew mutation must remain future-gated");
  assert(wiring.match(/enabledInProduct: false/g)?.length >= 6, "unsupported or unwired commands must remain disabled in Product");

  console.log("runtime-outage-product-server-boundary-harness PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
