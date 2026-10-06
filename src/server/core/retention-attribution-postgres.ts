import type {
  ActorContext,
  ReferralAttributionRowDTO,
  ReferralAttributionSummaryDTO,
  Result,
} from "../../contracts";
import type { SupabaseRpcClient } from "./payment-application-postgres";

type Row = Record<string, unknown>;

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function text(row: Row, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function finiteCount(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Malformed attribution response: ${key}`);
  }
  return value;
}

function mapReferral(row: Row): ReferralAttributionRowDTO {
  const referralCodeId = text(row, "referralCodeId");
  const code = text(row, "code");
  const label = text(row, "label");
  if (!referralCodeId || !code || !label) throw new Error("Malformed attribution response: identity");
  return {
    referralCodeId,
    code,
    label,
    active: row.active === true,
    touchCount: finiteCount(row, "touchCount"),
    paidJobCount: finiteCount(row, "paidJobCount"),
    firstTouchAt: text(row, "firstTouchAt"),
    lastTouchAt: text(row, "lastTouchAt"),
  };
}

export interface RetentionAttributionPort {
  readReferralAttribution(
    ctx: ActorContext,
    input: { from: string; to: string },
  ): Promise<Result<ReferralAttributionSummaryDTO>>;
  upsertReferralCode(
    ctx: ActorContext,
    input: { code: string; label: string; active: boolean; startsAt?: string; endsAt?: string; now: string },
  ): Promise<Result<{ referralCodeId: string; code: string; active: boolean }>>;
}

export function createPostgresRetentionAttributionPort(
  client: SupabaseRpcClient,
): RetentionAttributionPort {
  return {
    async readReferralAttribution(ctx, input) {
      if (!ctx.userId || !["OWNER", "DISPATCHER"].includes(ctx.role)) {
        return fail("FORBIDDEN", "Owner or dispatcher access is required.");
      }
      const { data, error } = await client.rpc<Row>("servicedesk_read_referral_attribution_summary", {
        p_input: {
          workspaceId: ctx.workspaceId,
          actorUserId: ctx.userId,
          actorRole: ctx.role,
          from: input.from,
          to: input.to,
        },
      });
      if (error) return fail(error.code ?? "ATTRIBUTION_RPC_ERROR", error.message);
      if (!data || data.ok === false) {
        return fail(String(data?.code ?? "ATTRIBUTION_RPC_REJECTED"), "Attribution summary could not be loaded.");
      }
      try {
        const rows = Array.isArray(data.rows)
          ? data.rows.filter((value): value is Row => Boolean(value) && typeof value === "object" && !Array.isArray(value))
          : [];
        return {
          ok: true,
          value: {
            from: String(data.from),
            to: String(data.to),
            rows: rows.map(mapReferral),
            disclosure: String(data.disclosure ?? "Attribution is directional, not perfect."),
          },
        };
      } catch (error) {
        return fail("ATTRIBUTION_RPC_MALFORMED", error instanceof Error ? error.message : "Malformed attribution response.");
      }
    },

    async upsertReferralCode(ctx, input) {
      if (!ctx.userId || ctx.role !== "OWNER") {
        return fail("FORBIDDEN", "Only an owner can manage referral codes.");
      }
      const { data, error } = await client.rpc<Row>("servicedesk_upsert_referral_code", {
        p_input: {
          workspaceId: ctx.workspaceId,
          actorUserId: ctx.userId,
          actorRole: ctx.role,
          code: input.code,
          label: input.label,
          active: input.active,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          now: input.now,
        },
      });
      if (error) return fail(error.code ?? "REFERRAL_CODE_RPC_ERROR", error.message);
      if (!data || data.ok === false) {
        return fail(String(data?.code ?? "REFERRAL_CODE_RPC_REJECTED"), "Referral code could not be saved.");
      }
      const referralCodeId = text(data, "referralCodeId");
      const code = text(data, "code");
      if (!referralCodeId || !code) return fail("REFERRAL_CODE_RPC_MALFORMED", "Referral code response was malformed.");
      return { ok: true, value: { referralCodeId, code, active: data.active === true } };
    },
  };
}
