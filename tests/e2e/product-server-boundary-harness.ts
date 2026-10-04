import { ok as assert, equal, deepEqual } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mapProductActionError } from "../../src/features/operations/action-state";
import { createEnquiryServerActionFactory, createScheduleServerActionFactory, createSendQuoteServerActionFactory } from "../../src/features/operations/server-action-adapters";

const root = process.cwd();
function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

async function main() {
  assert(!source("src/features/operations/OperationalRoute.tsx").includes("sample-data"), "OperationalRoute must not import sample-data");
  assert(source("src/features/operations/OperationalFixtureRoute.tsx").includes("sample-data"), "OperationalFixtureRoute must own fixtures");
  assert(source("src/features/operations/OperationalRoute.tsx").includes("data?: OperationalRouteData"), "OperationalRoute must accept typed data bundle");

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
    const file = source(path);
    assert(file.includes("OperationalFixtureRoute"), `${path} must use fixture wrapper`);
    assert(!file.includes("OperationalRoute\""), `${path} must not import OperationalRoute directly`);
  }

  for (const path of [
    "src/features/operations/OperationalRoute.tsx",
    "src/features/operations/action-state.ts",
    "src/features/operations/server-action-adapters.ts",
    "src/features/operations/server-wiring-map.ts",
  ]) {
    const file = source(path);
    assert(!file.includes("@/server/core"), `${path} must not import Core internals`);
    assert(!file.includes("src/server/core"), `${path} must not import Core repository paths`);
    assert(!file.includes("@/server/integrations"), `${path} must not import provider integrations`);
    assert(!file.includes("stripe"), `${path} must not call payment providers`);
    assert(!file.includes("whatsapp"), `${path} must not call messaging providers`);
    assert(!file.includes("google-calendar"), `${path} must not call calendar providers`);
  }

  const adapters = source("src/features/operations/server-action-adapters.ts");
  assert(adapters.indexOf("createRequest") < adapters.indexOf("updateRequest"), "create must precede update");
  assert(adapters.indexOf("updateRequest") < adapters.indexOf("calculateQuote"), "update must precede calculateQuote");
  assert(!adapters.includes("calculatePrice"), "Product must not calculate price client-side");
  assert(!adapters.includes("pricing"), "Product must not import pricing logic");
  assert(source("src/features/operations/server-wiring-map.ts").includes("enabledInProduct: false"), "unsupported commands must stay disabled");

  equal(mapProductActionError({ code: "VERSION_CONFLICT", message: "stale" }).status, "version_conflict");
  equal(mapProductActionError({ code: "AUTH_REQUIRED", message: "login" }).status, "auth_required");
  equal(mapProductActionError({ code: "WORKSPACE_DENIED", message: "workspace" }).status, "workspace_denied");
  equal(mapProductActionError({ code: "SLOT_UNAVAILABLE", message: "slot" }).status, "slot_unavailable");
  equal(mapProductActionError({ code: "HOLD_FAILED", message: "hold" }).status, "hold_failed");

  const calls: string[] = [];
  const enquiry = createEnquiryServerActionFactory({
    async createRequest() { calls.push("createRequest"); return { ok: true, value: { id: "req_1", version: 1 } as never }; },
    async updateRequest(input) { calls.push(`updateRequest:${input.requestId}:${input.expectedVersion}`); return { ok: true, value: { id: "req_1", version: 2 } as never }; },
    async calculateQuote(input) { calls.push(`calculateQuote:${input.requestId}:${input.requestVersion}`); return { ok: true, value: { id: "quote_1", version: 1 } as never }; },
  });
  equal((await enquiry({ context: { workspaceId: "ws", actorId: "user", idempotencyKey: "idem" }, request: {}, patch: {} })).ok, true);
  deepEqual(calls, ["createRequest", "updateRequest:req_1:1", "calculateQuote:req_1:2"]);

  const conflict = { code: "VERSION_CONFLICT", message: "stale version" };
  const failed = await createEnquiryServerActionFactory({
    async createRequest() { return { ok: true, value: { id: "req_1", version: 1 } as never }; },
    async updateRequest() { return { ok: false, error: conflict }; },
    async calculateQuote() { throw new Error("must not run"); },
  })({ context: { workspaceId: "ws", actorId: "user", idempotencyKey: "idem2" }, request: {}, patch: {} });
  equal(failed.ok, false);
  equal(failed.error, conflict);
  equal(failed.failedStep, "updateRequest");
  equal(failed.state.status, "version_conflict");

  const quote = await createSendQuoteServerActionFactory({ async sendQuote() { return { ok: false, error: { code: "AUTH_REQUIRED", message: "login" } }; } })({ context: { workspaceId: "ws", actorId: "user", idempotencyKey: "idem3" }, quoteId: "quote", expectedVersion: 1 });
  equal(quote.state.status, "auth_required");

  const schedule = createScheduleServerActionFactory({
    async findSlots() { return { ok: true, value: [] }; },
    async holdSlot() { return { ok: false, error: { code: "HOLD_FAILED", message: "expired" } }; },
  });
  equal((await schedule.findSlots({ context: { workspaceId: "ws", actorId: "user", idempotencyKey: "idem4" }, requestId: "req", quoteId: "quote" })).ok, true);
  equal((await schedule.holdSlot({ context: { workspaceId: "ws", actorId: "user", idempotencyKey: "idem5" }, slotId: "slot", requestId: "req", quoteId: "quote", expectedQuoteVersion: 1 })).state.status, "hold_failed");

  console.log("product-server-boundary-harness PASS");
}

main().catch((error) => { console.error(error); process.exit(1); });
