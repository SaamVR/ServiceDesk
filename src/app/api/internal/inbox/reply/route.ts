import { handleReviewedInboxReplyHttpPost } from "@/server/api-handlers/reviewed-inbox-reply-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** An explicitly human-confirmed, server-authorized reviewed reply boundary. */
export async function POST(request: Request): Promise<Response> {
  return handleReviewedInboxReplyHttpPost(request);
}
