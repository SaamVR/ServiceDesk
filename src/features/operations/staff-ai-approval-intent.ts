/** The browser's idempotent human approval retry identity.
 * Never reuse a key if any authorized source identity or exact approved
 * message body changes. The protected server independently validates all
 * permissions, source version and durable idempotency transaction.
 */
export interface StaffAiApprovalIntent {
  workspaceSlug:string;
  conversationId:string;
  sourceMessageId:string;
  expectedVersion:number;
  reviewedBody:string;
}
export function sameStaffAiApprovalIntent(
  previous:StaffAiApprovalIntent|undefined|null,
  next:StaffAiApprovalIntent,
):boolean {
  return !!previous && previous.workspaceSlug===next.workspaceSlug &&
    previous.conversationId===next.conversationId &&
    previous.sourceMessageId===next.sourceMessageId &&
    previous.expectedVersion===next.expectedVersion &&
    previous.reviewedBody===next.reviewedBody;
}
