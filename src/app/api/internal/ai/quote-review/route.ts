import { handleQuoteReviewPost } from "@/server/api-handlers/ai-quote-review-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleQuoteReviewPost(request);
}
