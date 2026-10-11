import {
  handleWhatsAppHttpChallenge,
  handleWhatsAppHttpPost,
} from "@/server/api-handlers/provider-whatsapp-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Meta challenge verification delegates to the configured trusted handler. */
export function GET(request: Request): Response {
  return handleWhatsAppHttpChallenge(request);
}

/** Raw-body HMAC validation, workspace mapping and persistence are backend-owned. */
export async function POST(request: Request): Promise<Response> {
  return handleWhatsAppHttpPost(request);
}
