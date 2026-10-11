import { handleRequestBriefPost } from "@/server/api-handlers/ai-request-brief-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleRequestBriefPost(request);
}
