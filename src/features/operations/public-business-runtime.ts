import { createClient } from "@supabase/supabase-js";

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
  visitorSessionId: string;
  submissionId: string;
  displayName: string;
  email?: string;
  phone?: string;
  serviceCode: string;
  bedrooms?: string;
  bathrooms?: string;
  preferredDate?: string;
  message?: string;
}

export type PublicEnquiryResult =
  | { ok: true; message: string; requestId: string }
  | { ok: false; message: string };

function optionalRoom(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10 ? parsed : undefined;
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
  const email = input.email?.trim().toLowerCase();
  const phone = input.phone?.trim();
  const serviceCode = input.serviceCode.trim();
  const preferredDate = input.preferredDate?.trim();
  const message = input.message?.trim();

  if (!displayName || displayName.length > 120) {
    return { ok: false, message: "Enter your name." };
  }
  if (!email && !phone) {
    return { ok: false, message: "Enter an email address or phone number so the team can reply." };
  }
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (phone && phone.length > 40) {
    return { ok: false, message: "Enter a valid phone number." };
  }
  if (!serviceCode || serviceCode.length > 80) {
    return { ok: false, message: "Choose a service." };
  }
  if (!input.visitorSessionId || input.visitorSessionId.length > 200 || !input.submissionId) {
    return { ok: false, message: "Refresh this page and submit the enquiry again." };
  }
  if (preferredDate && !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
    return { ok: false, message: "Choose a valid preferred date." };
  }
  if (message && message.length > 2000) {
    return { ok: false, message: "Keep your message under 2,000 characters." };
  }

  const bedrooms = optionalRoom(input.bedrooms);
  const bathrooms = optionalRoom(input.bathrooms);
  if (input.bedrooms?.trim() && bedrooms === undefined) {
    return { ok: false, message: "Bedrooms must be between 0 and 10." };
  }
  if (input.bathrooms?.trim() && bathrooms === undefined) {
    return { ok: false, message: "Bathrooms must be between 0 and 10." };
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
    return { ok: false, message: "This business page is not accepting enquiries right now." };
  }

  const { data, error } = await service.rpc("servicedesk_create_public_enquiry", {
    p_input: {
      workspaceId: workspaceResult.data.id,
      visitorSessionId: input.visitorSessionId,
      displayName,
      email: email || undefined,
      phone: phone || undefined,
      serviceCode,
      bedrooms,
      bathrooms,
      preferredDate: preferredDate || undefined,
      message: message || undefined,
      idempotencyKey: input.submissionId,
      now: new Date().toISOString(),
    },
  });

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, message: "Your enquiry could not be sent. Please try again." };
  }

  const result = data as Record<string, unknown>;
  if (result.ok !== true) {
    const code = String(result.code ?? "PUBLIC_ENQUIRY_REJECTED");
    const errorMessage =
      code === "SERVICE_NOT_FOUND"
        ? "That service is no longer available. Refresh the page and choose another service."
        : code === "PUBLIC_ENQUIRY_EMAIL_INVALID"
          ? "Enter a valid email address."
          : code === "PUBLIC_ENQUIRY_ROOMS_INVALID"
            ? "Check the bedroom and bathroom counts."
            : "Your enquiry could not be sent. Check the form and try again.";
    return { ok: false, message: errorMessage };
  }

  return {
    ok: true,
    message: "Thanks — your enquiry has been sent. The team can now follow up with you.",
    requestId: String(result.requestId),
  };
}
