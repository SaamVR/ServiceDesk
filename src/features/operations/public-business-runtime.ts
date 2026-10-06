import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  requestPhotoObjectPath,
  requestPhotoRetentionDays,
  validateRequestPhotoBytes,
} from "@/server/core/request-photo-upload";

export interface PublicBusinessSnapshot {
  workspace: { id: string; slug: string; name: string };
  services: Array<{ code: string; name: string; requiresReview: boolean }>;
}

export type PublicBusinessResult =
  | { ok: true; value: PublicBusinessSnapshot }
  | { ok: false; kind: "configuration" | "not_found" | "server"; message: string };

export async function loadPublicBusiness(slug: string): Promise<PublicBusinessResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return {
      ok: false,
      kind: "configuration",
      message: "Online service information is temporarily unavailable.",
    };
  }

  const service = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const workspaceResult = await service
    .from("workspaces")
    .select("id,slug,name")
    .eq("slug", slug)
    .maybeSingle();

  if (workspaceResult.error) {
    return { ok: false, kind: "server", message: "This business page could not be loaded." };
  }
  if (!workspaceResult.data) {
    return { ok: false, kind: "not_found", message: "This business page does not exist." };
  }

  const workspace = workspaceResult.data as { id: string; slug: string; name: string };
  const servicesResult = await service
    .from("service_catalog")
    .select("code,name,requires_review")
    .eq("workspace_id", workspace.id)
    .eq("active", true)
    .order("name", { ascending: true });

  if (servicesResult.error) {
    return { ok: false, kind: "server", message: "Available services could not be loaded." };
  }

  return {
    ok: true,
    value: {
      workspace,
      services: (servicesResult.data ?? []).map((row) => ({
        code: String(row.code),
        name: String(row.name),
        requiresReview: Boolean(row.requires_review),
      })),
    },
  };
}


export interface PublicEnquiryInput {
  displayName: string;
  email?: string;
  phone?: string;
  serviceCode: string;
  preferredDate?: string;
  bedrooms?: number;
  bathrooms?: number;
  message?: string;
  idempotencyKey: string;
}

export type PublicEnquiryResult =
  | { ok: true; requestId: string; message: string }
  | { ok: false; message: string };

function publicEnquiryFailure(code?: string): PublicEnquiryResult {
  if (code === "PUBLIC_ENQUIRY_RATE_LIMITED") {
    return { ok: false, message: "Too many enquiries were submitted recently. Please try again later." };
  }
  if (code === "PUBLIC_ENQUIRY_EMAIL_INVALID") {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (code === "PUBLIC_ENQUIRY_DATE_INVALID") {
    return { ok: false, message: "Choose a valid preferred date." };
  }
  if (code === "PUBLIC_ENQUIRY_ROOMS_INVALID") {
    return { ok: false, message: "Check the bedroom and bathroom counts." };
  }
  if (code === "SERVICE_NOT_FOUND") {
    return { ok: false, message: "That service is no longer available. Refresh the page and choose another service." };
  }
  return { ok: false, message: "Your enquiry could not be sent. Check the details and try again." };
}

export async function submitPublicEnquiry(
  slug: string,
  input: PublicEnquiryInput,
): Promise<PublicEnquiryResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return { ok: false, message: "Online enquiries are temporarily unavailable." };
  }

  const displayName = input.displayName.trim();
  const email = input.email?.trim() || undefined;
  const phone = input.phone?.trim() || undefined;
  const serviceCode = input.serviceCode.trim();
  const message = input.message?.trim() || undefined;
  const preferredDate = input.preferredDate?.trim() || undefined;

  if (!displayName || !serviceCode || (!email && !phone) || !input.idempotencyKey.trim()) {
    return { ok: false, message: "Add your name, a contact method and the service you need." };
  }
  if (displayName.length > 120 || (message?.length ?? 0) > 2000) {
    return { ok: false, message: "Some enquiry details are too long. Shorten them and try again." };
  }

  const service = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const workspaceResult = await service
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (workspaceResult.error || !workspaceResult.data) {
    return { ok: false, message: "This business is not accepting online enquiries right now." };
  }

  const cookieStore = await cookies();
  let visitorSessionId = cookieStore.get("servicedesk_visitor_session")?.value;
  if (!visitorSessionId) {
    visitorSessionId = crypto.randomUUID();
    cookieStore.set("servicedesk_visitor_session", visitorSessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  const { data, error } = await service.rpc("servicedesk_create_public_enquiry", {
    p_input: {
      workspaceId: String(workspaceResult.data.id),
      visitorSessionId,
      displayName,
      email,
      phone,
      serviceCode,
      preferredDate,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      message,
      idempotencyKey: input.idempotencyKey.trim(),
      now: new Date().toISOString(),
    },
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, message: "Your enquiry could not be sent. Please try again." };
  }

  const result = data as Record<string, unknown>;
  if (result.ok !== true) {
    return publicEnquiryFailure(typeof result.code === "string" ? result.code : undefined);
  }

  const requestId = typeof result.requestId === "string" ? result.requestId : "";
  if (!requestId) {
    return { ok: false, message: "Your enquiry was received but its reference could not be loaded." };
  }

  return {
    ok: true,
    requestId,
    message: "Thanks — your enquiry has been sent. The team can now review it and follow up with you.",
  };
}


export type PublicEnquiryPhotoResult =
  | { ok: true; assetId: string; message: string }
  | { ok: false; message: string };

export async function attachPublicEnquiryPhoto(
  slug: string,
  requestId: string,
  photo: File,
  processingConsent: boolean,
): Promise<PublicEnquiryPhotoResult> {
  if (!processingConsent) {
    return { ok: false, message: "Confirm photo-processing consent before attaching a photo." };
  }
  if (!(photo instanceof File) || photo.size <= 0) {
    return { ok: false, message: "Choose a photo to attach." };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SERVICEDESK_REQUEST_PHOTO_BUCKET?.trim();
  if (!url || !serviceRoleKey || !bucket) {
    return { ok: false, message: "Photo upload is not available right now. Your enquiry can still be reviewed without a photo." };
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await photo.arrayBuffer());
  } catch {
    return { ok: false, message: "The photo could not be read. Try another image." };
  }
  const validated = validateRequestPhotoBytes({ declaredType: photo.type, bytes });
  if (!validated.ok) return { ok: false, message: validated.message };

  const service = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const workspaceResult = await service
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (workspaceResult.error || !workspaceResult.data) {
    return { ok: false, message: "Photo upload is not available for this business." };
  }
  const workspaceId = String(workspaceResult.data.id);

  const cookieStore = await cookies();
  const visitorSessionId = cookieStore.get("servicedesk_visitor_session")?.value;
  if (!visitorSessionId) {
    return { ok: false, message: "Your enquiry session expired before the photo could be attached." };
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
    return { ok: false, message: "The photo could not be attached to this enquiry." };
  }

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
    return { ok: false, message: "The photo could not be prepared for upload." };
  }

  const uploaded = await service.storage
    .from(bucket)
    .upload(objectPath, validated.value.bytes, {
      contentType: validated.value.mediaType,
      upsert: false,
    });
  if (uploaded.error) {
    return { ok: false, message: "The photo could not be uploaded. Your enquiry remains available without it." };
  }

  const now = new Date();
  const retentionDays = requestPhotoRetentionDays(process.env.SERVICEDESK_REQUEST_PHOTO_RETENTION_DAYS);
  const retentionUntil = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
  const { data, error } = await service.rpc("servicedesk_register_request_photo_asset", {
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

  const row = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : undefined;
  if (error || !row || row.ok !== true || typeof row.assetId !== "string") {
    await service.storage.from(bucket).remove([objectPath]);
    return { ok: false, message: "The photo could not be registered safely. Your enquiry remains available without it." };
  }

  return {
    ok: true,
    assetId: row.assetId,
    message: "Your photo was attached for staff review. AI processing, when configured, remains advisory and requires human review.",
  };
}
