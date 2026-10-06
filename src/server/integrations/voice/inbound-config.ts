import type { Result } from "../../../contracts";

export interface VoiceInboundRuntimeConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  webhookSecret: string;
  workspaceByProviderAccountId: Record<string, string>;
}

type RuntimeEnvironment = Record<string, string | undefined>;

function fail(code: string, message: string): Result<VoiceInboundRuntimeConfig> {
  return { ok: false, code, message };
}

function parseAccountMap(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.length === 0) return undefined;
    const mapped: Record<string, string> = {};
    for (const [account, workspace] of entries) {
      if (!account.trim() || typeof workspace !== "string" || !workspace.trim()) return undefined;
      mapped[account.trim()] = workspace.trim();
    }
    return mapped;
  } catch {
    return undefined;
  }
}

export function readVoiceInboundRuntimeConfig(
  env: RuntimeEnvironment = process.env,
): Result<VoiceInboundRuntimeConfig> {
  const supabaseUrl = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const webhookSecret = (env.SERVICEDESK_VOICE_WEBHOOK_SECRET ?? "").trim();
  const workspaceByProviderAccountId = parseAccountMap(env.SERVICEDESK_VOICE_ACCOUNT_WORKSPACE_MAP);

  if (!supabaseUrl || !serviceRoleKey) {
    return fail("VOICE_INBOUND_DATABASE_CONFIG_MISSING", "Voice inbound database configuration is unavailable.");
  }
  if (!webhookSecret) {
    return fail("VOICE_INBOUND_WEBHOOK_SECRET_MISSING", "Voice inbound webhook signing configuration is unavailable.");
  }
  if (!workspaceByProviderAccountId) {
    return fail("VOICE_INBOUND_ACCOUNT_MAP_MISSING", "Voice inbound provider-account routing is unavailable.");
  }

  return {
    ok: true,
    value: { supabaseUrl, serviceRoleKey, webhookSecret, workspaceByProviderAccountId },
  };
}
