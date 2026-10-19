import {describe,expect,it} from "vitest";
import {sameStaffAiApprovalIntent} from "../../src/features/operations/staff-ai-approval-intent";
const original={
  workspaceSlug:"owner-cleaning",conversationId:"conv-a",
  sourceMessageId:"msg-v4",expectedVersion:4,
  reviewedBody:"Confirmed staff-approved reply, with exact punctuation.",
};
describe("R37 exact reviewed reply body bound to durable idempotency key",()=>{
  it("allows only exact source and body replay, never a new approval intent",()=>{
    expect(sameStaffAiApprovalIntent(original,{...original})).toBe(true);
    for(const changed of [
      {workspaceSlug:"another-owner"},{conversationId:"conv-b"},
      {sourceMessageId:"newer-msg"},{expectedVersion:5},
      {reviewedBody:original.reviewedBody+" "},
      {reviewedBody:"Different message"},
    ])expect(sameStaffAiApprovalIntent(original,{...original,...changed})).toBe(false);
  });
  it("fails closed without a prior explicit human approval intent",()=>{
    expect(sameStaffAiApprovalIntent(undefined,original)).toBe(false);
    expect(sameStaffAiApprovalIntent(null,original)).toBe(false);
  });
});
