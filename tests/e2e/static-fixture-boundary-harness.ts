import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

const reusableComponents = [
  "src/features/quotes/QuoteApprovalPreview.tsx",
  "src/features/schedule/SchedulePreview.tsx",
  "src/features/checkout/CheckoutPreview.tsx",
  "src/features/invoices/InvoiceLedgerPreview.tsx",
  "src/features/crm/CrmPreview.tsx",
  "src/features/crew/CrewJobPreview.tsx",
] as const;

const fixtureWrappers = [
  ["src/features/quotes/QuoteApprovalFixturePreview.tsx", "QuoteApprovalPreview"],
  ["src/features/schedule/ScheduleFixturePreview.tsx", "SchedulePreview"],
  ["src/features/checkout/CheckoutFixturePreview.tsx", "CheckoutPreview"],
  ["src/features/invoices/InvoiceLedgerFixturePreview.tsx", "InvoiceLedgerPreview"],
  ["src/features/crm/CrmFixturePreview.tsx", "CrmPreview"],
  ["src/features/crew/CrewJobFixturePreview.tsx", "CrewJobPreview"],
] as const;

for (const path of reusableComponents) {
  const file = source(path);
  assert.equal(file.includes("sample-data"), false, `${path} must not import sample-data`);
  assert.equal(file.includes("@/server"), false, `${path} must not import server modules`);
  assert.equal(file.includes("src/server"), false, `${path} must not import server modules`);
  assert.equal(file.includes("Repository"), false, `${path} must not access repositories directly`);
}

for (const [path, componentName] of fixtureWrappers) {
  const file = source(path);
  assert.ok(file.includes("sample-data"), `${path} must own fixture sample-data import`);
  assert.ok(file.includes(componentName), `${path} must wrap ${componentName}`);
}

const checkoutPreview = source("src/features/checkout/CheckoutPreview.tsx");
assert.ok(checkoutPreview.includes("disabled"), "checkout action must remain disabled");
assert.ok(checkoutPreview.includes("aria-disabled=\"true\""), "checkout action must be aria-disabled");
assert.ok(checkoutPreview.includes("hosted checkout command is not integrated"), "checkout disabled reason must be explicit");

const crewPreview = source("src/features/crew/CrewJobPreview.tsx");
assert.ok(crewPreview.includes("disabled"), "crew transition action must remain disabled");
assert.ok(crewPreview.includes("aria-disabled=\"true\""), "crew transition action must be aria-disabled");
assert.ok(crewPreview.includes("visit transition command is not integrated"), "crew disabled reason must be explicit");

const wiringMap = source("src/features/operations/server-wiring-map.ts");
for (const boundary of [
  "createRequest",
  "updateRequest",
  "calculateQuote",
  "sendQuote",
  "findSlots",
  "holdSlot",
  "future E03 payment bridge",
  "future readWorkspaceSnapshot",
  "future property reads",
  "future transitionVisit",
]) {
  assert.ok(wiringMap.includes(boundary), `wiring map must include ${boundary}`);
}
assert.equal(wiringMap.includes("from \"@/server"), false, "wiring map must not import server implementation");
assert.equal(wiringMap.includes("ServiceDeskFacade("), false, "wiring map must not instantiate a facade");

console.log("static-fixture-boundary-harness PASS");
