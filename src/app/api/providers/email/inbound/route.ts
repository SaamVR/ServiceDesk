import { createClient } from "@supabase/supabase-js";
import { handleEmailInboundWebhook } from "@/server/api-handlers/provider-email-inbound";
import { createPostgresConversationFacadeMethods } from "@/server/core/conversation-postgres";
import type { SupabaseRpcClient } from "@/server/core/payment-application-postgres";
import { readEmailInboundRuntimeConfig } from "@/server/integrations/email/inbound-config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const config = readEmailInboundRuntimeConfig();
  if (!config.ok) {
    return new Response("Email inbound is not configured.", { status: 503 });
  }

  const rawBody = await request.text();
  const service = createClient(config.value.supabaseUrl, config.value.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const store = createPostgresConversationFacadeMethods(service as unknown as SupabaseRpcClient);

  const result = await handleEmailInboundWebhook({
    rawBody,
    headers: Object.fromEntries(request.headers.entries()),
    webhookSecret: config.value.webhookSecret,
    workspaceByProviderAccountId: config.value.workspaceByProviderAccountId,
    store,
  });

  return new Response(result.body, {
    status: result.statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
