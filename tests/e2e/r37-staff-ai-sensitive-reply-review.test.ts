import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {
 detectStaffReplyRisks,staffReplyRiskLabels,hasUnsafeReplyFormatting,
} from "../../src/features/operations/staff-ai-reply-risk";
const ui=readFileSync(join(process.cwd(),
 "src/features/operations/StaffAiReviewComposer.tsx"),"utf8");
describe("R37 deliberate higher-risk AI reply review",()=>{
 it("keeps everyday reply drafts on normal human confirmation path",()=>{
   expect(detectStaffReplyRisks("We have received your request. What date works best?")).toEqual([]);
   expect(detectStaffReplyRisks("")).toEqual([]);
   expect(detectStaffReplyRisks(null)).toEqual([]);
 });
 it("detects obvious unverified customer-facing business and contact claims",()=>{
   const cases=[
    ["Please visit https://outside.test/checkout","EXTERNAL_LINK"],
    ["Email support@outside.example now","CONTACT_INSTRUCTION"],
    ["Call us at +1 (555) 010-0020","CONTACT_INSTRUCTION"],
    ["The cleaning costs $250","PAYMENT_CLAIM"],
    ["Please pay the deposit today","PAYMENT_CLAIM"],
    ["Your booking confirmed for tomorrow","BOOKING_COMMITMENT"],
    ["We guarantee service completed by Tuesday","BOOKING_COMMITMENT"],
    ["Your booking is confirmed for next week.","BOOKING_COMMITMENT"],
    ["Our visit has been scheduled.","BOOKING_COMMITMENT"],
    ["We have scheduled your appointment.","BOOKING_COMMITMENT"],
    ["We\'ve completed your cleaning.","BOOKING_COMMITMENT"],
    ["The service is booked for Friday.","BOOKING_COMMITMENT"],
   ] as const;
   for(const [body,label] of cases)expect(detectStaffReplyRisks(body)).toContain(label);
   const all=detectStaffReplyRisks("Pay $200 at https://outside.test and call us to confirm your booking.");
   expect(all).toContain("EXTERNAL_LINK");
   expect(all).toContain("CONTACT_INSTRUCTION");
   expect(all).toContain("PAYMENT_CLAIM");
   expect(all).not.toContain("BOOKING_COMMITMENT");
 });
 it("returns only fixed categories without copying private customer content",()=>{
   const sensitive="Contact jane@private.example or call +44 7900 123456";
   const result=detectStaffReplyRisks(sensitive);
   expect(JSON.stringify(result)).not.toContain("jane");
   expect(Object.keys(staffReplyRiskLabels)).toHaveLength(4);
   expect(result.every(x=>typeof staffReplyRiskLabels[x]==="string")).toBe(true);
 });
 it("blocks edited text-direction spoofing while allowing readable paragraphs",()=>{
   expect(hasUnsafeReplyFormatting("Hello,\nPlease share your date.\tThanks")).toBe(false);
   expect(hasUnsafeReplyFormatting("Pay "+String.fromCodePoint(0x202e)+"$500")).toBe(true);
   expect(hasUnsafeReplyFormatting("Call "+String.fromCodePoint(0x200b)+"this")).toBe(true);
   expect(hasUnsafeReplyFormatting("Quote "+String.fromCharCode(0)+"complete")).toBe(true);
   expect(hasUnsafeReplyFormatting(undefined)).toBe(false);
   expect(ui).toContain("const unsafeFormatting = hasUnsafeReplyFormatting(body)");
   expect(ui).toContain("!confirmed || unsafeFormatting");
   expect(ui).toContain("confirmed && !unsafeFormatting");
   expect(ui).toContain("Remove those characters before approving");
 });
 it("requires TWO independent confirmations for sensitive edited replies",()=>{
   expect(ui).toContain("const reviewRisks = detectStaffReplyRisks(body)");
   expect(ui).toContain("needsSensitiveReview && !sensitiveConfirmed");
   expect(ui).toContain("(!needsSensitiveReview || sensitiveConfirmed)");
   expect(ui).toContain("checked={sensitiveConfirmed}");
   expect(ui).toContain("setSensitiveConfirmed(false)");
   expect(ui).toContain("Heuristic detection may miss risks.");
   expect(ui).toContain("I verified these statements against saved records");
   expect(ui).toContain("confirmedByStaff: true");
   expect(ui).toContain("idempotencyKey.current ??= crypto.randomUUID()");
   expect(ui).not.toContain("sendCustomerMessage(");
 });
});