import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isSameOriginPhotoUpload,
  readBoundedRequestPhotoBody,
  requestPhotoObjectPath,
  requestPhotoRetentionDays,
  validateRequestPhotoBytes,
} from "@/server/core/request-photo-upload";

const responseHeaders = {
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
};

function response(
  status: number,
  body: { ok: boolean; message: string; assetId?: string },
) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}

export async function POST(request: Request) {
  if (!isSameOriginPhotoUpload(request)) {
    return response(403, { ok: false, message: "Photo upload origin was not accepted." });
  }
  if (request.headers.get("x-servicedesk-photo-processing-consent") !== "granted") {
    return response(400, { ok: false, message: "Confirm photo-processing consent before uploading." });
  }

  const requestUrl = new URL(request.url);
  const workspaceSlug = requestUrl.searchParams.get("workspace")?.trim();
  const requestId = requestUrl.searchParams.get("request")?.trim();
  if (!workspaceSlug || !requestId) {
    return response(400, { ok: false, message: "Photo upload is missing its enquiry reference." });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SERVICEDESK_REQUEST_PHOTO_BUCKET?.trim();
  if (
    !url
    || !serviceRoleKey
    || !bucket
    || !/^[a-z0-9][a-z0-9_-]{1,62}$/i.test(bucket)
  ) {
    return response(503, {
      ok: false,
      message: "Photo upload is not configured. Your enquiry remains available without a photo.",
    });
  }

  const service = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const workspaceResult = await service
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .maybeSingle();
  if (workspaceResult.error || !workspaceResult.data) {
    return response(404, { ok: false, message: "This business is not accepting photo uploads." });
  }
  const workspaceId = String(workspaceResult.data.id);

  const cookieStore = await cookies();
  const visitorSessionId = cookieStore.get("servicedesk_visitor_session")?.value;
  if (!visitorSessionId) {
    return response(401, { ok: false, message: "Your enquiry session has expired." });
  }

  const requestResult = await service
    .from("requests")
    .select("id,visitor_session_id")
    .eq("workspace_id", workspaceId)
    .eq("id", requestId)
    .maybeSingle();
  if (
    requestResult.error
    || !requestResult.data
    || String(requestResult.data.visitor_session_id ?? "") !== visitorSessionId
  ) {
    return response(403, { ok: false, message: "This photo cannot be attached to that enquiry." });
  }

  const assetCount = await service
    .from("request_photo_assets")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("request_id", requestId)
    .neq("state", "DELETED");
  if (assetCount.error) {
    return response(503, {
      ok: false,
      message: "Photo intake is not available in this environment yet.",
    });
  }
  if ((assetCount.count ?? 0) >= 5) {
    return response(409, {
      ok: false,
      message: "This enquiry already has the maximum number of review photos.",
    });
  }

  const body = await readBoundedRequestPhotoBody(request);
  if (!body.ok) return response(413, { ok: false, message: body.message });

  const validated = validateRequestPhotoBytes({
    declaredType: request.headers.get("content-type")?.split(";")[0]?.trim() ?? "",
    bytes: body.value,
  });
  if (!validated.ok) return response(415, { ok: false, message: validated.message });

  const assetToken = crypto.randomUUID();
  let objectPath: string;
  try {
    objectPath = requestPhotoObjectPath({
      workspaceId,
      requestId,
      assetToken,
      extension: validated.value.extension,
    });
  } catch {
    return response(400, { ok: false, message: "The photo upload reference is invalid." });
  }

  const uploaded = await service.storage
    .from(bucket)
    .upload(objectPath, validated.value.bytes, {
      contentType: validated.value.mediaType,
      upsert: false,
    });
  if (uploaded.error) {
    return response(502, {
      ok: false,
      message: "The photo could not be stored. Your enquiry remains available without it.",
    });
  }

  const now = new Date();
  const retentionDays = requestPhotoRetentionDays(
    process.env.SERVICEDESK_REQUEST_PHOTO_RETENTION_DAYS,
  );
  const retentionUntil = new Date(
    now.getTime() + retentionDays * 24 * 60 * 60 * 1000,
  );
  const registered = await service.rpc("servicedesk_register_request_photo_asset", {
    p_input: {
      workspaceId,
      actorRole: "VISITOR",
      actorVisitorSessionId: visitorSessionId,
      requestId,
      source: "CUSTOMER_UPLOAD",
      storageRef: `supabase://${bucket}/${objectPath}`,
      contentType: validated.value.mediaType,
      byteSize: validated.value.bytes.byteLength,
      consentStatus: "GRANTED",
      consentSource: "PUBLIC_ENQUIRY_PHOTO_OPT_IN",
      consentRecordedAt: now.toISOString(),
      processingOptOut: false,
      trainingAllowed: false,
      retentionUntil: retentionUntil.toISOString(),
      now: now.toISOString(),
    },
  });
  const row = registered.data && typeof registered.data === "object" && !Array.isArray(registered.data)
    ? registered.data as Record<string, unknown>
    : undefined;
  if (registered.error || !row || row.ok !== true || typeof row.assetId !== "string") {
    await service.storage.from(bucket).remove([objectPath]);
    return response(502, {
      ok: false,
      message: "The photo could not be registered safely. Your enquiry remains available without it.",
    });
  }

  return response(201, {
    ok: true,
    assetId: row.assetId,
    message: "Photo attached for staff review. AI analysis, when configured, is advisory and never changes a quote automatically.",
  });
}
