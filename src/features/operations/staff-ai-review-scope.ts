/**
 * A human-approved reply is tied to one saved source message AND version.
 * Never carry its draft, consent checkbox or idempotency key into a different
 * tenant, conversation, message, or updated conversation version.
 */
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
