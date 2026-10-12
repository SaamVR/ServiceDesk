/** Request briefs are always staff-only suggestions about a single saved
 * request. Treat network/provider JSON as untrusted until scope and fields
 * have been checked. This contains no DB write or provider execution. */
export interface SavedAiRequestBrief {
  state: "AI_DRAFT_REQUIRES_REVIEW";
  requestId: string;
  model: string;
  briefing: string;
  source: "AUTHORIZED_SAVED_REQUEST";
}
export function parseSavedAiRequestBrief(
  value: unknown, expectedRequestId: string,
): SavedAiRequestBrief | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj=value as Record<string,unknown>;
  if(obj.state!=="AI_DRAFT_REQUIRES_REVIEW" ||
     obj.source!=="AUTHORIZED_SAVED_REQUEST" ||
     obj.requestId!==expectedRequestId ||
     typeof obj.model!=="string" || !obj.model.trim() ||
     obj.model.length>100 || /[\u0000-\u001f]/.test(obj.model) ||
     typeof obj.briefing!=="string" ||
     !obj.briefing.trim() || obj.briefing.length>900) return null;
  return {
    state:"AI_DRAFT_REQUIRES_REVIEW",
    requestId:expectedRequestId,
    source:"AUTHORIZED_SAVED_REQUEST",
    model:obj.model,
    briefing:obj.briefing,
  };
}
