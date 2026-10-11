import {
  handleWhatsAppHttpChallenge,
  handleWhatsAppHttpPost,
} from "@/server/api-handlers/provider-whatsapp-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request): Response {
  return handleWhatsAppHttpChallenge(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleWhatsAppHttpPost(request);
}
