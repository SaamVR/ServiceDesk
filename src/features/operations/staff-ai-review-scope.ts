/** Browser React key for a human-reviewed reply. Reusing a composer under
 * another workspace, thread, source message or conversation version MUST
 * reset any editable draft, approval checkbox and idempotency key. */
export function staffAiReviewScopeKey(input: {
  workspaceSlug: string;
  conversationId: string;
  sourceMessageId: string;
  expectedVersion: number;
}): string {
  return JSON.stringify([
    input.workspaceSlug, input.conversationId,
    input.sourceMessageId, input.expectedVersion,
  ]);
}
