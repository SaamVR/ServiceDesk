import type {F15AttentionProof} from "@/server/workflows/sonic-f15-owner-linked-attention";

/** A successful write receipt is not enough to claim the refreshed
 * aggregate proof independently verified the transition. No send, retry,
 * or database write is initiated by this predicate.
 */
export function isF15AcknowledgementProgressVerified(
 before:F15AttentionProof,after:F15AttentionProof,
):boolean{
 if(before.state!=="LINKED_INTERNAL_ATTENTION_VERIFIED"||
    after.state!=="LINKED_INTERNAL_ATTENTION_VERIFIED")return false;
 if(before.open!==1||before.count<1||after.count!==before.count||
    !Number.isSafeInteger(before.count)||
    !Number.isSafeInteger(before.acknowledged)||
    !Number.isSafeInteger(before.resolved)||
    before.acknowledged<0||before.resolved<0||
    before.open+before.acknowledged+before.resolved!==before.count)
  return false;
 return after.open===0&&
   after.acknowledged===before.acknowledged+1&&
   after.resolved===before.resolved&&
   after.open+after.acknowledged+after.resolved===after.count&&
   after.humanReviewRequired===true&&after.workflowExecuted===false&&
   after.customerMessaged===false;
}
