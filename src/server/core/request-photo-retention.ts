import type { SupabaseClient } from "@supabase/supabase-js";
import type { Result } from "../../contracts";
import { parseSupabasePhotoStorageRef } from "./request-photo-storage";

type Row = Record<string, unknown>;

export interface RequestPhotoRetentionRun {
  scanned: number;
  deleted: number;
  retiredForRetry: number;
  skipped: number;
}

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function object(value: unknown): Row | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Row
    : undefined;
}

export async function purgeDueRequestPhotos(input: {
  service: SupabaseClient;
  workspaceId: string;
  now: string;
  limit?: number;
}): Promise<Result<RequestPhotoRetentionRun>> {
  const limit = Math.max(1, Math.min(input.limit ?? 50, 100));
  const due = await input.service
    .from("request_photo_assets")
    .select("id,version,state,retention_until,processing_opt_out")
    .eq("workspace_id", input.workspaceId)
    .in("state", ["AVAILABLE", "RETIRED"])
    .or(`retention_until.lte.${input.now},state.eq.RETIRED,processing_opt_out.eq.true`)
    .order("retention_until", { ascending: true })
    .limit(limit);

  if (due.error) {
    return fail("PHOTO_RETENTION_SCAN_FAILED", "Request photo retention scan failed.");
  }

  const outcome: RequestPhotoRetentionRun = {
    scanned: due.data?.length ?? 0,
    deleted: 0,
    retiredForRetry: 0,
    skipped: 0,
  };

  for (const asset of due.data ?? []) {
    const id = String((asset as Row).id ?? "");
    const version = Number((asset as Row).version ?? 0);
    if (!id || !Number.isFinite(version) || version < 1) {
      outcome.skipped += 1;
      continue;
    }

    const claimed = await input.service.rpc("servicedesk_claim_request_photo_for_deletion", {
      p_input: {
        workspaceId: input.workspaceId,
        photoAssetId: id,
        expectedVersion: version,
        now: input.now,
      },
    });
    const claim = object(claimed.data);
    if (claimed.error || !claim || claim.ok !== true) {
      outcome.skipped += 1;
      continue;
    }
    if (claim.state === "DELETED") {
      outcome.deleted += 1;
      continue;
    }

    const storage = parseSupabasePhotoStorageRef(String(claim.storageRef ?? ""));
    const claimedVersion = Number(claim.version ?? 0);
    if (!storage || !Number.isFinite(claimedVersion) || claimedVersion < 1) {
      outcome.retiredForRetry += 1;
      continue;
    }

    const removed = await input.service.storage.from(storage.bucket).remove([storage.objectPath]);
    if (removed.error) {
      outcome.retiredForRetry += 1;
      continue;
    }

    const marked = await input.service.rpc("servicedesk_mark_request_photo_deleted", {
      p_input: {
        workspaceId: input.workspaceId,
        photoAssetId: id,
        expectedVersion: claimedVersion,
        now: input.now,
      },
    });
    const mark = object(marked.data);
    if (marked.error || !mark || mark.ok !== true || mark.state !== "DELETED") {
      outcome.retiredForRetry += 1;
      continue;
    }
    outcome.deleted += 1;
  }

  return { ok: true, value: outcome };
}
