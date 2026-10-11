import { handleStaffAiHttpPost } from "@/server/api-handlers/ai-staff-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleStaffAiHttpPost(request);
}
