import type { ClaimedOutboxEvent, Result } from "../../contracts";
import type { SupabaseRpcClient } from "../core/payment-application-postgres";

export interface OutboxGuardDecision {
  allowed: boolean;
  code?: string;
}

export interface OutboxExecutionGuard {
  check(event: ClaimedOutboxEvent, now: string): Promise<Result<OutboxGuardDecision>>;
}

type Row = Record<string, unknown>;

function fail(code: string, message: string): Result<OutboxGuardDecision> {
  return { ok: false, code, message };
}

export function createPostgresRetentionCampaignExecutionGuard(
  client: SupabaseRpcClient,
): OutboxExecutionGuard {
  return {
    async check(event, now) {
      if (event.topic !== "retention.campaign") {
        return { ok: true, value: { allowed: true } };
      }

      const { data, error } = await client.rpc<Row>(
        "servicedesk_check_retention_campaign_dispatch_eligibility",
        {
          p_input: {
            workspaceId: event.workspaceId,
            eventId: event.id,
            now,
          },
        },
      );

      if (error) {
        return fail(error.code ?? "CAMPAIGN_GUARD_RPC_ERROR", error.message);
      }
      if (!data || data.ok !== true) {
        return fail(
          String(data?.code ?? "CAMPAIGN_GUARD_RPC_REJECTED"),
          "Campaign eligibility could not be verified.",
        );
      }

      if (data.allowed !== true) {
        const code = typeof data.code === "string" && data.code.trim()
          ? data.code
          : "CAMPAIGN_SUPPRESSED";
        return { ok: true, value: { allowed: false, code } };
      }

      return { ok: true, value: { allowed: true, code: "CAMPAIGN_ELIGIBLE" } };
    },
  };
}
