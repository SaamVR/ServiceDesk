import type { SupabaseClient } from "@supabase/supabase-js";
import type { Result } from "../../contracts";
import { parseSupabasePhotoStorageRef } from "../core/request-photo-storage";
import { validateRequestPhotoBytes } from "../core/request-photo-upload";
import type {
  PhotoIntakeExecutionContext,
  PhotoIntakeExecutionPort,
  PhotoSuggestionRecord,
  PhotoSuggestionRecordInput,
} from "./photo-intake-execution";

type Row = Record<string, unknown>;

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function row(value: unknown): Row | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Row
    : undefined;
}

export function createSupabasePhotoIntakeExecutionPort(
  service: SupabaseClient,
): PhotoIntakeExecutionPort {
  return {
    async loadContext(input): Promise<Result<PhotoIntakeExecutionContext>> {
      if (!input.classifierRef.trim() || input.classifierRef.length > 160) {
        return fail("PHOTO_AI_CONFIGURATION_BLOCKED", "Photo classifier reference is invalid.");
      }

      const assetResult = await service
        .from("request_photo_assets")
        .select("id,request_id,storage_ref,content_type,byte_size,consent_status,processing_opt_out,training_allowed,retention_until,state")
        .eq("workspace_id", input.workspaceId)
        .eq("id", input.photoAssetId)
        .maybeSingle();
      const asset = row(assetResult.data);
      if (assetResult.error || !asset || String(asset.request_id) !== input.requestId) {
        return fail("PHOTO_ASSET_NOT_FOUND", "Photo asset is not available for this request.");
      }

      const retentionUntil = Date.parse(String(asset.retention_until ?? ""));
      const now = Date.parse(input.now);
      if (
        asset.state !== "AVAILABLE"
        || asset.consent_status !== "GRANTED"
        || asset.processing_opt_out === true
        || asset.training_allowed !== false
        || !Number.isFinite(retentionUntil)
        || !Number.isFinite(now)
        || retentionUntil <= now
      ) {
        return fail("PHOTO_PROCESSING_NOT_ALLOWED", "Photo asset is not eligible for AI processing.");
      }

      const services = await service
        .from("service_catalog")
        .select("code")
        .eq("workspace_id", input.workspaceId)
        .eq("active", true)
        .order("code", { ascending: true });
      if (services.error) {
        return fail("PHOTO_AI_CATALOG_UNAVAILABLE", "Approved service categories could not be loaded.");
      }
      const allowedCategoryCodes = (services.data ?? [])
        .map((item) => String((item as Row).code ?? "").trim())
        .filter(Boolean);
      if (allowedCategoryCodes.length === 0) {
        return fail("PHOTO_AI_CATEGORY_ALLOWLIST_REQUIRED", "No approved service categories are available.");
      }

      const storage = parseSupabasePhotoStorageRef(String(asset.storage_ref ?? ""));
      if (!storage) {
        return fail("PHOTO_STORAGE_REF_INVALID", "Photo asset storage reference is invalid.");
      }
      const downloaded = await service.storage.from(storage.bucket).download(storage.objectPath);
      if (downloaded.error || !downloaded.data) {
        return fail("PHOTO_STORAGE_DOWNLOAD_FAILED", "Photo bytes could not be loaded for classification.");
      }
      const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
      const validated = validateRequestPhotoBytes({
        declaredType: String(asset.content_type ?? ""),
        bytes,
      });
      if (!validated.ok) return validated;
      if (
        typeof asset.byte_size === "number"
        && asset.byte_size !== validated.value.bytes.byteLength
      ) {
        return fail("PHOTO_STORAGE_SIZE_MISMATCH", "Stored photo size no longer matches registered metadata.");
      }

      return {
        ok: true,
        value: {
          classifierRef: input.classifierRef,
          request: {
            workspaceId: input.workspaceId,
            requestId: input.requestId,
            photoAssetId: input.photoAssetId,
            consentStatus: "GRANTED",
            processingOptOut: false,
            trainingAllowed: false,
            allowedCategoryCodes,
            allowedAddOnCodes: [],
            image: {
              mediaType: validated.value.mediaType,
              bytes: validated.value.bytes,
            },
          },
        },
      };
    },

    async recordSuggestion(input: PhotoSuggestionRecordInput): Promise<Result<PhotoSuggestionRecord>> {
      const { data, error } = await service.rpc("servicedesk_record_request_photo_suggestion", {
        p_input: input,
      });
      const result = row(data);
      if (error || !result || result.ok !== true || typeof result.suggestionId !== "string") {
        return fail(
          "PHOTO_SUGGESTION_RECORD_FAILED",
          "Validated photo suggestion could not be recorded for staff review.",
        );
      }
      return {
        ok: true,
        value: {
          suggestionId: result.suggestionId,
          duplicate: result.duplicate === true,
        },
      };
    },
  };
}
