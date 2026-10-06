import { createClient } from "@supabase/supabase-js";
import { handleVoiceMissedCallWebhook } from "@/server/api-handlers/provider-voice";
import type { SupabaseRpcClient } from "@/server/core/payment-application-postgres";
import { createPostgresVoiceMissedCallCommandPort } from "@/server/core/voice-missed-call-postgres";
import { readVoiceInboundRuntimeConfig } from "@/server/integrations/voice/inbound-config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const config = readVoiceInboundRuntimeConfig();
  if (!config.ok) {
    return new Response("Voice inbound is not configured.", { status: 503 });
  }

  const rawBody = await request.text();
  const service = createClient(config.value.supabaseUrl, config.value.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const store = createPostgresVoiceMissedCallCommandPort(service as unknown as SupabaseRpcClient);

  const result = await handleVoiceMissedCallWebhook({
    rawBody,
    headers: Object.fromEntries(request.headers.entries()),
    webhookSecret: config.value.webhookSecret,
    receivedAt: new Date().toISOString(),
    workspaceByProviderAccountId: config.value.workspaceByProviderAccountId,
    store,
  });

  return new Response(result.body, {
    status: result.statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
