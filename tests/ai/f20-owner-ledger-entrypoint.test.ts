import {describe,it,expect} from "vitest";
import {requestF20OwnerFinanceReview} from "../../src/features/operations/f20-owner-finance-review-action";
import {readFileSync} from "node:fs";
describe("F20 owner-only saved ledger exception entrypoint",()=>{
 it("refuses invalid workspace path without a ledger lookup",async()=>{
  expect(await requestF20OwnerFinanceReview("invalid/path")).toEqual({
   ok:false,state:"SAVED_LEDGER_REVIEW_UNAVAILABLE"});
 });
 it("delegates to saved verified F03 ledger, not the model, provider or payment command",()=>{
  const x=readFileSync("src/features/operations/f20-owner-finance-review-action.ts","utf8");
  expect(x).toContain("loadF03AuthorizedLedgerExplanation(slug)");
  expect(x).toContain("paymentConfirmed:false");
  expect(x).toContain("refundAuthorized:false");
  expect(x).toContain("financialWrites:false");
  for(const bad of ["fetch(", ".rpc(", "process.env.", "sendEmail(", "createPayment("])
    expect(x).not.toContain(bad);
 });
 it("owner-readable invoice ID links are record-scoped and cannot approve payments",()=>{
  const x=readFileSync("src/features/operations/OwnerLedgerExceptionReview.tsx","utf8");
  expect(x).toContain('key={workspaceSlug}');
  expect(x).toContain("serial.current!==seq");
  expect(x).toContain('"?invoice="+encodeURIComponent(x.invoiceId)');
  expect(x).toContain("No paid status, refund, balance write or external message was authorized.");
 });
});
