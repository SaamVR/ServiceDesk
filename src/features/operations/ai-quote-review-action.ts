"use server";

import { generateAuthorizedQuoteReview } from "@/server/ai/quote-review";

export async function generateQuoteReviewAction(workspaceSlug: string, quoteId: string):
  Promise<{ ok: true; review: string; model: string } | { ok: false; message: string }> {
  const result = await generateAuthorizedQuoteReview({ workspaceSlug, quoteId });
  if (!result.ok) return {
    ok: false, message: "AI review is not available for this saved quote. Check approved pricing and AI settings; no customer contact was made.",
  };
  return { ok: true, review: result.value.review, model: result.value.model };
}
