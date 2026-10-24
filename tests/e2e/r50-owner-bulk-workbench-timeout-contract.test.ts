import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";

const ui=readFileSync(join(process.cwd(),
 "src/features/operations/OwnerStarterBatchWorkbench.tsx"),"utf8");
const style=readFileSync(join(process.cwd(),
 "src/features/operations/OwnerStarterBatchWorkbench.module.css"),"utf8");
const preview=readFileSync(join(process.cwd(),
 "src/features/operations/owner-starter-batch-preview-action.ts"),"utf8");

describe("R50 frontend owner starter preview timeout/review contract",()=>{
 it("bounds browser wait and rejects stale responses without claiming upstream cancellation",()=>{
  expect(ui).toContain("REVIEW_WAIT_LIMIT_MS=30_000");
  expect(ui).toContain("const waitTimeout=setTimeout(");
  expect(ui).toContain("if(sequence!==requestSequence.current)return;");
  expect(ui).toContain("requestSequence.current+=1;");
  expect(ui).toContain("clearTimeout(waitTimeout);");
  expect(ui).toContain("A server request may still finish");
  expect(ui).toContain("aria-busy={busy}");
 });
 it("links only server verified catalogue selections to the existing human draft editor",()=>{
  expect(ui).toContain('href={"?template="+encodeURIComponent(d.starterId)}');
  expect(ui).toContain("review required");
  expect(preview).toContain("const template=automationPlaybooks.find(");
  expect(preview).toContain("seen.has(draft.starterId)");
  expect(preview).toContain("selected.has(draft.starterId)");
  expect(preview).toContain("ownerPublishRequired!==true");
  expect(style).toContain(".reviewLink:focus-visible");
 });
 it("never activates model inference, customer send or paid ledger mutation from review",()=>{
  expect(ui).not.toContain("fetch(");
  expect(ui).not.toContain("sendCustomerMessage(");
  expect(ui).not.toContain("publishOperationalWorkflowVersion(");
  expect(preview).not.toContain("saveOperationalWorkflowDraft(");
  expect(preview).toContain("paidModelInvoked:false");
  expect(preview).toContain("paymentChanged:false");
  expect(preview).toContain("providerMessagesSent:false");
 });
});
