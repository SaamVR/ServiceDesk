import { NextResponse } from "next/server";
import { resolveStaffActor } from "@/features/operations/operational-product-runtime";
import { parseSupabasePhotoStorageRef } from "@/server/core/request-photo-storage";

const responseHeaders = {
  "cache-control": "private, no-store, max-age=0",
  "content-security-policy": "default-src 'none'; sandbox",
  "x-content-type-options": "nosniff",
};

export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  const workspaceSlug = new URL(request.url).searchParams.get("workspace")?.trim();
  const { assetId } = await context.params;
  if (!workspaceSlug || !assetId?.trim()) {
    return new NextResponse("Photo asset request is incomplete.", { status: 400, headers: responseHeaders });
  }

  const resolved = await resolveStaffActor(workspaceSlug);
  if (!resolved.ok) {
    const status = resolved.kind === "authentication" ? 401 : resolved.kind === "authorization" ? 403 : 404;
    return new NextResponse("Photo asset is not available.", { status, headers: responseHeaders });
  }

  const asset = await resolved.value.service
    .from("request_photo_assets")
    .select("id,storage_ref,content_type,consent_status,processing_opt_out,retention_until,state")
    .eq("workspace_id", resolved.value.workspace.id)
    .eq("id", assetId)
    .maybeSingle();

  if (asset.error || !asset.data) {
    return new NextResponse("Photo asset is not available.", { status: 404, headers: responseHeaders });
  }

  const row = asset.data as {
    storage_ref?: string;
    content_type?: string;
    consent_status?: string;
    processing_opt_out?: boolean;
    retention_until?: string;
    state?: string;
  };
  const retainedUntil = row.retention_until ? Date.parse(row.retention_until) : Number.NaN;
  if (
    row.state !== "AVAILABLE"
    || row.consent_status !== "GRANTED"
    || row.processing_opt_out === true
    || !Number.isFinite(retainedUntil)
    || retainedUntil <= Date.now()
  ) {
    return new NextResponse("Photo asset is no longer available for review.", { status: 410, headers: responseHeaders });
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(row.content_type ?? "")) {
    return new NextResponse("Photo asset type is not supported.", { status: 415, headers: responseHeaders });
  }

  const storage = parseSupabasePhotoStorageRef(row.storage_ref ?? "");
  if (!storage) {
    return new NextResponse("Photo asset storage reference is not supported.", { status: 409, headers: responseHeaders });
  }

  const downloaded = await resolved.value.service.storage
    .from(storage.bucket)
    .download(storage.objectPath);

  if (downloaded.error || !downloaded.data) {
    return new NextResponse("Photo asset could not be loaded.", { status: 502, headers: responseHeaders });
  }

  return new NextResponse(downloaded.data, {
    status: 200,
    headers: {
      ...responseHeaders,
      "content-type": row.content_type ?? "application/octet-stream",
      "content-disposition": 'inline; filename="request-photo"',
    },
  });
}
