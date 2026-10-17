import {describe,expect,it} from "vitest";
import {validateStaffQuoteReviewDraft,validateStaffQuoteReviewGrounding}
 from "../../src/server/ai/quote-review-safety";
describe("R17 AI staff quote review no operational completion hallucinations",()=>{
 it("rejects crew schedules, past visits, unobserved customer choices and promises",()=>{
  for(const unsafe of [
   "Our crew will arrive tomorrow.",
   "The cleaning team has already completed the service.",
   "Your appointment is scheduled.",
   "The customer's visit has been confirmed.",
   "The customer requested the 9 AM appointment.",
   "Our team will email the confirmation.",
   "Staff are visiting the property.",
   "The crew has already arrived.",
   "We will dispatch a technician.",
  ]) expect(validateStaffQuoteReviewDraft(unsafe),unsafe).toBeUndefined();
 });
 it("retains actionable but unasserted staff review instructions",()=>{
  const safe=[
   "Ask staff to verify the saved room counts before quote approval.",
   "Review whether the appointment requires a capacity check.",
   "Check saved bedroom time against the service scope.",
   "Ask a human to verify access arrangements before proposing a visit.",
  ];
  for(const line of safe) expect(validateStaffQuoteReviewDraft(line),line).toBe(line);
 });
 it("does not bypass saved line-item grounding while filtering operational assertions",()=>{
  expect(validateStaffQuoteReviewGrounding("Our crew will arrive tomorrow.",["STANDARD"]))
   .toBeUndefined();
  expect(validateStaffQuoteReviewGrounding("Verify oven service scope.",["STANDARD"]))
   .toBeUndefined();
  expect(validateStaffQuoteReviewGrounding("Verify oven service scope.",["OVEN"]))
   .toBe("Verify oven service scope.");
 });
});
