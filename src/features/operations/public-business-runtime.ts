import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

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
