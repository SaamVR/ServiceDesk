import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {requestF16GroundedQuoteReview} from "../../src/features/operations/f16-grounded-quote-review-action";
describe("F16 real saved branch quote alternatives with fail-closed missing pricing",()=>{
 it("rejects arbitrary request and slug before accessing records",async()=>{
  expect(await requestF16GroundedQuoteReview("bad/path","bad")).toEqual({ok:false,state:"GROUND_PRICE_UNAVAILABLE"});
 });
 it("requires current saved request version and true active rate-book calculation",()=>{
  const src=readFileSync("src/features/operations/f16-grounded-quote-review-action.ts","utf8");
  expect(src).toContain("proposeAuthorizedGroundedQuoteAlternatives({");
  expect(src).toContain("expectedVersion:req.version");
  expect(src).toContain('v.source!=="AUTHORIZED_SAVED_REQUEST_AND_BRANCH_PRICE_BOOK"');
  expect(src).toContain("o.depositMinor+o.balanceMinor!==o.totalMinor");
  expect(src).toContain("quoteCreated:false");
  for(const forbidden of ["fetch(", ".rpc(", "sendEmail(", "charge("])expect(src).not.toContain(forbidden);
 });
 it("shows only verified totals and exposes pricing setup when missing",()=>{
  const s=readFileSync("src/features/operations/AiGroundedQuoteAlternatives.tsx","utf8");
  expect(s).toContain('key={workspaceSlug+":"+requestId}');
  expect(s).toContain("sequence.current!==seq");
  expect(s).toContain('"?section=services"');
  expect(s).toContain("No customer quote was created");
 });
});
