import type { Result } from "../../../contracts";

/** Server-only WhatsApp webhook configuration. No key or mapping in client bundles. */
export interface WhatsAppInboundRuntimeConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  appSecret: string;
  verifyToken: string;
  workspaceByPhoneNumberId: Readonly<Record<string, string>>;
}

type RuntimeEnvironment = Record<string, string | undefined>;

function parseAccountMap(raw: string | undefined): Readonly<Record<string, string>> | undefined {
  if (!raw || raw.length > 16_384) return undefined;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return undefined; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (!entries.length || entries.length > 100) return undefined;
  const mapped: Record<string, string> = Object.create(null);
  for (const [phoneNumberId, workspaceId] of entries) {
    if (!/^[0-9]{3,32}$/.test(phoneNumberId) ||
        typeof workspaceId !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(workspaceId)) return undefined;
    mapped[phoneNumberId] = workspaceId;
  }
  return mapped;
}

export function readWhatsAppInboundRuntimeConfig(
  env: RuntimeEnvironment = process.env,
): Result<WhatsAppInboundRuntimeConfig> {
  const supabaseUrl = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const appSecret = (env.SERVICEDESK_WHATSAPP_APP_SECRET ?? "").trim();
  const verifyToken = (env.SERVICEDESK_WHATSAPP_VERIFY_TOKEN ?? "").trim();
  const workspaceByPhoneNumberId = parseAccountMap(env.SERVICEDESK_WHATSAPP_ACCOUNT_WORKSPACE_MAP);
  if (!supabaseUrl || !serviceRoleKey || !/^https:\/\//.test(supabaseUrl)) {
    return { ok: false, code: "WHATSAPP_INBOUND_DATABASE_CONFIG_MISSING",
      message: "WhatsApp inbound database configuration is unavailable." };
  }
  if (!appSecret || !verifyToken) {
    return { ok: false, code: "WHATSAPP_INBOUND_AUTH_CONFIG_MISSING",
      message: "WhatsApp Meta app secret or verification token is unavailable." };
  }
  if (!workspaceByPhoneNumberId) {
    return { ok: false, code: "WHATSAPP_INBOUND_ACCOUNT_MAP_MISSING",
      message: "WhatsApp number-to-workspace routing is unavailable or invalid." };
  }
  return { ok: true, value: {
    supabaseUrl, serviceRoleKey, appSecret, verifyToken, workspaceByPhoneNumberId,
  } };
}
