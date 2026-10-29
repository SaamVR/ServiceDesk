import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(p,"utf8");
describe("F20 independent finance and consent-journey critic",()=>{
 it("no payment authority or invented settlement in ledger entrypoint",()=>{
  const x=read("src/features/operations/f20-owner-finance-review-action.ts");
  expect(x).toContain("loadF03AuthorizedLedgerExplanation(slug)");
  expect(x).toContain("v.paymentConfirmed!==false");
  expect(x).toContain("refundAuthorized:false");
  expect(x).toContain("modelInvoked:false");
  for(const forbidden of ["process.env.", "paymentIntent", "fetch(", ".rpc(", "sendEmail(", "charge(", "updateInvoice("])
   expect(x).not.toContain(forbidden);
 });
 it("consent candidates are bounded and never become outbound messages",()=>{
  const s=read("src/features/operations/f20-owner-retention-review-action.ts");
  expect(s).toContain("proposeF04SavedRetentionReview(slug)");
  expect(s).toContain("candidates.slice(0,25)");
  expect(s).toContain("manualContactAndPurposeRevalidationRequired!==true");
  expect(s).toContain("c.customerContactSent!==false");
  expect(s).toContain("c.outreachScheduled!==false");
  expect(s).not.toContain("recipientEmail:");
  expect(s).not.toContain("sendWhatsApp(");
 });
 it("clients require saved-only success and recheck workspace after selection change",()=>{
  const a=read("src/features/operations/OwnerLedgerExceptionReview.tsx");
  const b=read("src/features/operations/OwnerConsentedRetentionReview.tsx");
  expect(a).toContain('key={workspaceSlug}');
  expect(b).toContain('key={workspaceSlug}');
  expect(a).toContain("serial.current!==seq");
  expect(b).toContain("seq.current!==sequence");
  expect(a).toContain("No payment, refund or customer communication occurred.");
  expect(b).toContain("No outreach, automated follow-up, payment change");
  for(const x of [a,b]){
   expect(x).not.toContain("sendEmail(");
   expect(x).not.toContain("sendWhatsApp(");
  }
 });
});
