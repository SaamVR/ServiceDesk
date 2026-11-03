import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(p,"utf8");
describe("F19 independent adversarial journey critic",()=>{
 it("case decision path retains human-only closure and denies invented media proof",()=>{
  const source=read("src/features/operations/f19-quality-case-guidance.ts");
  expect(source).toContain("canResolveAutomatically:false");
  expect(source).toContain("photoObjectsVerified:false");
  expect(source).toContain("customerContactSent:false");
  expect(source).toContain("reworkScheduled:false");
  for(const forbidden of ["applyOperationalQualityAction(","sendEmail(","sendWhatsApp(","modelTransport","process.env."])
   expect(source).not.toContain(forbidden);
 });
 it("quality panel refuses lost branch scope and never guesses default case for action",()=>{
  const source=read("src/features/operations/QualityCaseFollowthroughPanel.tsx");
  expect(source).toContain('scope.selectedBranchId');
  expect(source).toContain("selectedCaseId?cases.find(");
  expect(source).toContain("if(!selected)return");
  expect(source).toContain('scope.mode==="ALL"');
  expect(source).toContain("canReviewVisit");
  expect(source).toContain("No automatic resolution, message or rework scheduling occurred.");
 });
 it("quote panel denies foreign/missing request, no auto issue and no ambiguous top-version link",()=>{
  const panel=read("src/features/operations/QuoteRecoveryReadinessPanel.tsx");
  const plan=read("src/features/operations/f19-quote-recovery-targets.ts");
  expect(panel).toContain("authorized.has(q.requestId)");
  expect(panel).toContain("selectedQuoteId?quotes.find(");
  expect(panel).toContain("if(!selected)return");
  expect(plan).toContain("highest.length===1");
  expect(plan).toContain("automaticRenewal:false");
  expect(plan).toContain("automaticSend:false");
  expect(panel).toContain("Current quote revision is ambiguous or unavailable");
  for(const forbidden of ["sendOperationalQuote(","issueQuote(","sendEmail(","process.env."])
   expect(panel+plan).not.toContain(forbidden);
 });
});
