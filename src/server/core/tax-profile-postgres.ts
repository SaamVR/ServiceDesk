import type {
  ActorContext,
  Result,
  TaxProfileProvenanceKind,
  WorkspaceTaxProfileDTO,
  WorkspaceTaxProfileSnapshotDTO,
} from "../../contracts";
import type { SupabaseRpcClient } from "./payment-application-postgres";

type RpcRow = Record<string, unknown>;

export interface UpsertTaxProfileInput {
  profileId?: string;
  expectedVersion?: number;
  jurisdictionCode: string;
  taxCode: string;
  rateBasisPoints: number;
  priceIncludesTax: boolean;
  provenanceKind: TaxProfileProvenanceKind;
  provenanceReference: string;
  effectiveFrom: string;
  effectiveTo?: string;
  now: string;
}

export interface ReviewTaxProfileInput {
  profileId: string;
  expectedVersion: number;
  accountantReviewConfirmed: true;
  reviewAttestation: string;
  now: string;
}

export interface RetireTaxProfileInput {
  profileId: string;
  expectedVersion: number;
  now: string;
}

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function object(value: unknown, key: string): RpcRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Malformed tax profile payload: ${key}`);
  }
  return value as RpcRow;
}

function list(value: unknown, key: string): RpcRow[] {
  if (!Array.isArray(value)) throw new Error(`Malformed tax profile payload: ${key}`);
  return value.map((item, index) => object(item, `${key}[${index}]`));
}

function string(row: RpcRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Malformed tax profile payload: ${key}`);
  return value;
}

function optionalString(row: RpcRow, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function number(row: RpcRow, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Malformed tax profile payload: ${key}`);
  return value;
}

function boolean(row: RpcRow, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") throw new Error(`Malformed tax profile payload: ${key}`);
  return value;
}

function mapProfile(value: unknown): WorkspaceTaxProfileDTO {
  const row = object(value, "profile");
  const status = string(row, "status") as WorkspaceTaxProfileDTO["status"];
  const provenanceKind = string(row, "provenanceKind") as WorkspaceTaxProfileDTO["provenanceKind"];
  if (!["DRAFT", "REVIEWED", "RETIRED"].includes(status)) throw new Error("Malformed tax profile payload: status");
  if (!["ACCOUNTANT_GUIDANCE", "TAX_AUTHORITY", "ACCOUNTING_SYSTEM", "OTHER"].includes(provenanceKind)) {
    throw new Error("Malformed tax profile payload: provenanceKind");
  }
  return {
    id: string(row, "id"),
    workspaceId: string(row, "workspaceId"),
    jurisdictionCode: string(row, "jurisdictionCode"),
    taxCode: string(row, "taxCode"),
    rateBasisPoints: number(row, "rateBasisPoints"),
    priceIncludesTax: boolean(row, "priceIncludesTax"),
    status,
    provenanceKind,
    provenanceReference: string(row, "provenanceReference"),
    effectiveFrom: string(row, "effectiveFrom"),
    effectiveTo: optionalString(row, "effectiveTo"),
    reviewedByUserId: optionalString(row, "reviewedByUserId"),
    reviewedAt: optionalString(row, "reviewedAt"),
    version: number(row, "version"),
    createdAt: string(row, "createdAt"),
    updatedAt: string(row, "updatedAt"),
  };
}

function mapSnapshot(value: unknown, workspaceId: string): WorkspaceTaxProfileSnapshotDTO {
  const row = object(value, "snapshot");
  const automaticApplicationEnabled = boolean(row, "automaticApplicationEnabled");
  if (automaticApplicationEnabled) {
    throw new Error("Tax profile snapshot attempted to enable automatic application.");
  }
  const snapshot: WorkspaceTaxProfileSnapshotDTO = {
    workspaceId: string(row, "workspaceId"),
    automaticApplicationEnabled: false,
    profiles: list(row.profiles, "profiles").map(mapProfile),
  };
  if (
    snapshot.workspaceId !== workspaceId
    || snapshot.profiles.some((profile) => profile.workspaceId !== workspaceId)
  ) {
    throw new Error("Tax profile payload crossed workspace scope.");
  }
  return snapshot;
}

function authorizedStaff(ctx: ActorContext): boolean {
  return Boolean(ctx.userId) && (ctx.role === "OWNER" || ctx.role === "DISPATCHER");
}

function authorizedOwner(ctx: ActorContext): boolean {
  return Boolean(ctx.userId) && ctx.role === "OWNER";
}

function rejected<T>(data: RpcRow | null, fallback: string): Result<T> {
  return fail(String(data?.code ?? fallback), "Tax profile command was rejected by the authoritative database boundary.");
}

export function createPostgresTaxProfilePort(client: SupabaseRpcClient) {
  return {
    async readTaxProfileSnapshot(ctx: ActorContext): Promise<Result<WorkspaceTaxProfileSnapshotDTO>> {
      if (!authorizedStaff(ctx)) return fail("FORBIDDEN", "Owner or dispatcher access is required for tax profiles.");
      const { data, error } = await client.rpc<RpcRow>("servicedesk_read_tax_profile_snapshot", {
        p_input: { workspaceId: ctx.workspaceId, actorUserId: ctx.userId, actorRole: ctx.role },
      });
      if (error) return fail(error.code ?? "TAX_PROFILE_READ_ERROR", error.message);
      if (!data || data.ok === false) return rejected(data, "TAX_PROFILE_READ_REJECTED");
      try {
        return { ok: true, value: mapSnapshot(data.snapshot, ctx.workspaceId) };
      } catch (error) {
        return fail("TAX_PROFILE_READ_MALFORMED", error instanceof Error ? error.message : "Malformed tax profile response.");
      }
    },

    async upsertTaxProfile(ctx: ActorContext, input: UpsertTaxProfileInput): Promise<Result<WorkspaceTaxProfileDTO>> {
      if (!authorizedOwner(ctx)) return fail("FORBIDDEN", "Owner access is required to change tax profiles.");
      const { data, error } = await client.rpc<RpcRow>("servicedesk_upsert_tax_profile", {
        p_input: { workspaceId: ctx.workspaceId, actorUserId: ctx.userId, actorRole: ctx.role, ...input },
      });
      if (error) return fail(error.code ?? "TAX_PROFILE_RPC_ERROR", error.message);
      if (!data || data.ok === false) return rejected(data, "TAX_PROFILE_SAVE_REJECTED");
      try {
        const profile = mapProfile(data.profile);
        if (profile.workspaceId !== ctx.workspaceId) throw new Error("Tax profile crossed workspace scope.");
        return { ok: true, value: profile };
      } catch (error) {
        return fail("TAX_PROFILE_RPC_MALFORMED", error instanceof Error ? error.message : "Malformed tax profile response.");
      }
    },

    async reviewTaxProfile(ctx: ActorContext, input: ReviewTaxProfileInput): Promise<Result<WorkspaceTaxProfileDTO>> {
      if (!authorizedOwner(ctx)) return fail("FORBIDDEN", "Owner access is required to record tax review.");
      const { data, error } = await client.rpc<RpcRow>("servicedesk_review_tax_profile", {
        p_input: { workspaceId: ctx.workspaceId, actorUserId: ctx.userId, actorRole: ctx.role, ...input },
      });
      if (error) return fail(error.code ?? "TAX_PROFILE_RPC_ERROR", error.message);
      if (!data || data.ok === false) return rejected(data, "TAX_PROFILE_REVIEW_REJECTED");
      try {
        const profile = mapProfile(data.profile);
        if (profile.workspaceId !== ctx.workspaceId) throw new Error("Tax profile crossed workspace scope.");
        return { ok: true, value: profile };
      } catch (error) {
        return fail("TAX_PROFILE_RPC_MALFORMED", error instanceof Error ? error.message : "Malformed tax profile response.");
      }
    },

    async retireTaxProfile(ctx: ActorContext, input: RetireTaxProfileInput): Promise<Result<WorkspaceTaxProfileDTO>> {
      if (!authorizedOwner(ctx)) return fail("FORBIDDEN", "Owner access is required to retire tax profiles.");
      const { data, error } = await client.rpc<RpcRow>("servicedesk_retire_tax_profile", {
        p_input: { workspaceId: ctx.workspaceId, actorUserId: ctx.userId, actorRole: ctx.role, ...input },
      });
      if (error) return fail(error.code ?? "TAX_PROFILE_RPC_ERROR", error.message);
      if (!data || data.ok === false) return rejected(data, "TAX_PROFILE_RETIRE_REJECTED");
      try {
        const profile = mapProfile(data.profile);
        if (profile.workspaceId !== ctx.workspaceId) throw new Error("Tax profile crossed workspace scope.");
        return { ok: true, value: profile };
      } catch (error) {
        return fail("TAX_PROFILE_RPC_MALFORMED", error instanceof Error ? error.message : "Malformed tax profile response.");
      }
    },
  };
}
