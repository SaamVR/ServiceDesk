import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {requestF20RetentionReview} from "../../src/features/operations/f20-owner-retention-review-action";
describe("F20 owner consent-aware repeat cleaning source",()=>{
 it("rejects bad workspace without reading provider/customer history",async()=>{
  expect(await requestF20RetentionReview("bad/path")).toEqual({
   ok:false,state:"SAVED_RETENTION_UNAVAILABLE"});
 });
 it("uses F04 verified double-read saved opt-in, not churn or automatic outreach",()=>{
  const action=readFileSync("src/features/operations/f20-owner-retention-review-action.ts","utf8");
  expect(action).toContain("proposeF04SavedRetentionReview(slug)");
  expect(action).toContain("churnProven:false");
  expect(action).toContain("sendConsentMustBeRechecked:true");
  expect(action).toContain("outreachScheduled:false");
  expect(action).toContain("candidates.slice(0,25)");
  for(const bad of ["fetch(", "sendEmail(", "sendWhatsApp(", "process.env.", "processPayment("])
   expect(action).not.toContain(bad);
 });
 it("only offers owner review links, no contact address or send control",()=>{
  const ui=readFileSync("src/features/operations/OwnerConsentedRetentionReview.tsx","utf8");
  expect(ui).toContain("key={workspaceSlug}");
  expect(ui).toContain("seq.current!==sequence");
  expect(ui).toContain('"?customer="+encodeURIComponent(c.customerId)');
  expect(ui).toContain("service gap is not proof of churn");
  expect(ui).not.toContain('type="email"');
 });
});
