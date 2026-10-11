import { createClient } from "@supabase/supabase-js";
import type { SupabaseRpcClient } from "../core/payment-application-postgres";
import { createPostgresConversationFacadeMethods } from "../core/conversation-postgres";
import { inboundWebhookResponse, readBoundedWebhookBody } from "./inbound-http-policy";
import { handleWhatsAppChallenge } from "./provider-whatsapp";
import { handleWhatsAppRuntimeWebhook } from "./provider-whatsapp-runtime";
import type { ProviderDeliveryStatusStore } from "./provider-whatsapp";
import {
  readWhatsAppInboundRuntimeConfig,
  type WhatsAppInboundRuntimeConfig,
} from "../integrations/whatsapp/inbound-config";

type RuntimeEnv = Record<string, string | undefined>;

export interface WhatsAppHttpDependencies {
  /** A trusted, server-side database client constructor; never a browser client. */
  createClient?: (config: WhatsAppInboundRuntimeConfig) => SupabaseRpcClient;
  /** Explicit durable delivery status authority. Without it POST returns 503 for statuses. */
  statusStore?: ProviderDeliveryStatusStore;
}

function defaultClient(config: WhatsAppInboundRuntimeConfig): SupabaseRpcClient {
  const client = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client as unknown as SupabaseRpcClient;
}

/** Can be bound by the Next.js route without duplicating signature or tenant policy. */
export function handleWhatsAppHttpChallenge(
  request: Request,
  env: RuntimeEnv = process.env,
): Response {
  const config = readWhatsAppInboundRuntimeConfig(env);
  if (!config.ok) {
    return new Response("WhatsApp webhook is not configured.", {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
  let url: URL;
  try { url = new URL(request.url); } catch {
    return new Response("Invalid WhatsApp challenge URL.", { status: 400 });
  }
  const query = {
    "hub.mode": url.searchParams.get("hub.mode") ?? undefined,
    "hub.verify_token": url.searchParams.get("hub.verify_token") ?? undefined,
    "hub.challenge": url.searchParams.get("hub.challenge") ?? undefined,
  };
  const result = handleWhatsAppChallenge(query, config.value.verifyToken);
  return new Response(result.body ?? "", {
    status: result.statusCode,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Requires Meta's raw-body HMAC signature and a configured workspace mapping.
 * Unverified, malformed, or unmapped callbacks never reach the service-role
 * database client. Inbound customer messages are persisted by the existing
 * trusted, idempotent PostgreSQL RPC; delivery receipts require another
 * explicitly provided durable authority and are otherwise retried.
 */
export async function handleWhatsAppHttpPost(
  request: Request,
  env: RuntimeEnv = process.env,
  dependencies: WhatsAppHttpDependencies = {},
): Promise<Response> {
  const config = readWhatsAppInboundRuntimeConfig(env);
  if (!config.ok) {
    return inboundWebhookResponse({
      statusCode: 503,
      body: "WhatsApp inbound is not configured.",
      retryable: true,
    });
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return inboundWebhookResponse({
      statusCode: 415, body: "WhatsApp webhook requires JSON content.", retryable: false,
    });
  }

  let bounded: Awaited<ReturnType<typeof readBoundedWebhookBody>>;
  try {
    bounded = await readBoundedWebhookBody(request);
  } catch {
    return inboundWebhookResponse({
      statusCode: 400, body: "WhatsApp webhook body could not be read.", retryable: false,
    });
  }
  if (!bounded.ok) {
    return inboundWebhookResponse({
      statusCode: bounded.statusCode, body: bounded.body, retryable: false,
    });
  }

  // Do not instantiate a privileged RPC connection for an unauthenticated
  // request. The processor checks HMAC and tenant mapping before any RPC.
  // Constructed lazily so invalid input never touches the database.
  let scopedClient: SupabaseRpcClient | undefined;
  const store = {
    async applyInboundMessage(event: Parameters<ReturnType<typeof createPostgresConversationFacadeMethods>["applyInboundMessage"]>[0]) {
      if (!scopedClient) scopedClient = (dependencies.createClient ?? defaultClient)(config.value);
      return createPostgresConversationFacadeMethods(scopedClient).applyInboundMessage(event);
    },
  };

  const status = await handleWhatsAppRuntimeWebhook({
    rawBody: bounded.rawBody,
    headers: Object.fromEntries(request.headers.entries()),
    appSecret: config.value.appSecret,
    workspaceByPhoneNumberId: config.value.workspaceByPhoneNumberId,
    store,
    statusStore: dependencies.statusStore,
  });
  return inboundWebhookResponse({
    statusCode: status.statusCode,
    body: status.body,
    retryable: status.retryable,
  });
}
