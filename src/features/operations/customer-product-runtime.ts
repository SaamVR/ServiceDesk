import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { ActorContext, QuoteDTO } from "@/contracts";
import type { SupabaseRpcClient } from "@/server/core/payment-application-postgres";
import { createPostgresRequestQuoteCapacityFacadeMethods } from "@/server/core/request-quote-capacity-postgres";

type Row = Record<string, unknown>;

export interface CustomerPortalProperty {
  id: string;
  label: string;
  address: string;
  serviceNotes?: string;
  accessNotes?: string;
}

export interface CustomerPortalRequest {
  id: string;
  propertyId?: string;
  serviceLabel: string;
  status: string;
  requestedStartAt?: string;
}

export interface CustomerPortalQuote {
  id: string;
  requestId: string;
  version: number;
  status: QuoteDTO["status"];
  currency: string;
  totalMinor: number;
  depositMinor: number;
  balanceMinor: number;
  durationMinutes: number;
  bufferMinutes: number;
  validUntil: string;
}

export interface CustomerPortalVisit {
  id: string;
  requestId: string;
  quoteId: string;
  status: string;
  startAt: string;
  endAt?: string;
}

export interface CustomerPortalInvoice {
  id: string;
  quoteId?: string;
  visitId?: string;
  status: string;
  currency: string;
  totalMinor: number;
  allocatedMinor: number;
  refundedMinor: number;
  balanceMinor: number;
}

export interface CustomerPortalConsent {
  id: string;
  channel: string;
  purpose: string;
  status: string;
  source: string;
  recordedAt: string;
}

export interface CustomerPortalSnapshot {
  loadedAt: string;
  workspace: { id: string; slug: string; name: string };
  customer: { id: string; displayName: string };
  actor: ActorContext;
  properties: CustomerPortalProperty[];
  requests: CustomerPortalRequest[];
  quotes: CustomerPortalQuote[];
  visits: CustomerPortalVisit[];
  invoices: CustomerPortalInvoice[];
  consents: CustomerPortalConsent[];
}

export type CustomerPortalResult =
  | { ok: true; value: CustomerPortalSnapshot }
  | {
      ok: false;
      kind: "configuration" | "authentication" | "authorization" | "workspace_selection" | "server";
      message: string;
    };

export type CustomerPortalActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

interface ResolvedCustomer {
  workspace: { id: string; slug: string; name: string };
  customer: { id: string; displayName: string };
  actor: ActorContext;
  service: SupabaseClient;
  rpc: SupabaseRpcClient;
}

function textValue(row: Row, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(row: Row, key: string): number {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function runtimeConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) return undefined;
  return { url, anonKey, serviceRoleKey };
}

async function resolveCustomer(): Promise<
  { ok: true; value: ResolvedCustomer } | Extract<CustomerPortalResult, { ok: false }>
> {
  const config = runtimeConfig();
  if (!config) {
    return {
      ok: false,
      kind: "configuration",
      message: "The customer portal is temporarily unavailable.",
    };
  }

  const cookieStore = await cookies();
  const auth = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Cookie refresh is owned by application authentication middleware.
      },
    },
  });

  const { data: authData, error: authError } = await auth.auth.getUser();
  if (authError || !authData.user) {
    return {
      ok: false,
      kind: "authentication",
      message: "Sign in with the customer account linked to your service record.",
    };
  }

  const service = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const customerResult = await service
    .from("customers")
    .select("id,workspace_id,display_name")
    .eq("auth_user_id", authData.user.id)
    .is("archived_at", null)
    .limit(3);

  if (customerResult.error) {
    return { ok: false, kind: "server", message: "Your customer account could not be loaded." };
  }

  const customerRows = rows(customerResult.data);
  if (customerRows.length === 0) {
    return {
      ok: false,
      kind: "authorization",
      message: "This sign-in is not linked to an active customer record.",
    };
  }
  if (customerRows.length > 1) {
    return {
      ok: false,
      kind: "workspace_selection",
      message: "This account is linked to more than one business. Choose a business before continuing.",
    };
  }

  const customerRow = customerRows[0];
  const workspaceId = String(customerRow.workspace_id);
  const workspaceResult = await service
    .from("workspaces")
    .select("id,slug,name")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceResult.error || !workspaceResult.data) {
    return { ok: false, kind: "server", message: "The linked business could not be loaded." };
  }

  const workspace = workspaceResult.data as { id: string; slug: string; name: string };
  const customer = {
    id: String(customerRow.id),
    displayName: String(customerRow.display_name ?? "Customer"),
  };
  const actor: ActorContext = {
    workspaceId: workspace.id,
    userId: authData.user.id,
    role: "CUSTOMER",
  };

  return {
    ok: true,
    value: {
      workspace,
      customer,
      actor,
      service,
      rpc: service as unknown as SupabaseRpcClient,
    },
  };
}

function mapQuote(row: Row, workspaceId: string): QuoteDTO {
  return {
    id: String(row.id),
    workspaceId,
    requestId: String(row.request_id),
    version: numberValue(row, "version"),
    status: String(row.status) as QuoteDTO["status"],
    currency: String(row.currency),
    subtotalMinor: numberValue(row, "subtotal_minor"),
    taxMinor: numberValue(row, "tax_minor"),
    totalMinor: numberValue(row, "total_minor"),
    depositMinor: numberValue(row, "deposit_minor"),
    balanceMinor: numberValue(row, "balance_minor"),
    durationMinutes: numberValue(row, "duration_minutes"),
    bufferMinutes: numberValue(row, "buffer_minutes"),
    rateVersion: String(row.rate_version ?? ""),
    validUntil: String(row.valid_until),
  };
}

export async function loadCustomerPortalSnapshot(): Promise<CustomerPortalResult> {
  const resolved = await resolveCustomer();
  if (!resolved.ok) return resolved;

  const { workspace, customer, actor, service } = resolved.value;
  const [propertiesResult, servicesResult, requestsResult, consentsResult] = await Promise.all([
    service
      .from("properties")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("customer_id", customer.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    service.from("service_catalog").select("id,code,name").eq("workspace_id", workspace.id),
    service
      .from("requests")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    service
      .from("communication_consents")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("customer_id", customer.id)
      .order("recorded_at", { ascending: false }),
  ]);

  const firstError = [propertiesResult, servicesResult, requestsResult, consentsResult].find(
    (result) => result.error,
  )?.error;
  if (firstError) {
    return { ok: false, kind: "server", message: "Your service records could not be loaded." };
  }

  const propertyRows = rows(propertiesResult.data);
  const serviceRows = rows(servicesResult.data);
  const requestRows = rows(requestsResult.data);
  const requestIds = requestRows.map((row) => String(row.id));
  const serviceById = new Map(serviceRows.map((row) => [String(row.id), row]));

  const quoteResult =
    requestIds.length === 0
      ? { data: [], error: null }
      : await service
          .from("quotes")
          .select("*")
          .eq("workspace_id", workspace.id)
          .in("request_id", requestIds)
          .order("created_at", { ascending: false });

  if (quoteResult.error) {
    return { ok: false, kind: "server", message: "Your quote history could not be loaded." };
  }

  const quoteRows = rows(quoteResult.data);
  const quoteIds = quoteRows.map((row) => String(row.id));

  const [visitsResult, invoicesResult] = await Promise.all([
    requestIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : service
          .from("visits")
          .select("*")
          .eq("workspace_id", workspace.id)
          .in("request_id", requestIds)
          .order("starts_at", { ascending: false }),
    quoteIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : service
          .from("invoices")
          .select("*")
          .eq("workspace_id", workspace.id)
          .in("quote_id", quoteIds)
          .order("created_at", { ascending: false }),
  ]);

  if (visitsResult.error || invoicesResult.error) {
    return { ok: false, kind: "server", message: "Your booking or invoice history could not be loaded." };
  }

  return {
    ok: true,
    value: {
      loadedAt: new Date().toISOString(),
      workspace,
      customer,
      actor,
      properties: propertyRows.map((row) => ({
        id: String(row.id),
        label: textValue(row, "label") ?? "Property",
        address: [textValue(row, "address_line1"), textValue(row, "city"), textValue(row, "postal_code")]
          .filter(Boolean)
          .join(", "),
        serviceNotes: textValue(row, "service_notes"),
        accessNotes: textValue(row, "access_notes"),
      })),
      requests: requestRows.map((row) => {
        const serviceRow = row.service_id ? serviceById.get(String(row.service_id)) : undefined;
        return {
          id: String(row.id),
          propertyId: textValue(row, "property_id"),
          serviceLabel: serviceRow ? String(serviceRow.name ?? serviceRow.code ?? "Service") : "Service",
          status: String(row.status),
          requestedStartAt: textValue(row, "requested_start_at"),
        };
      }),
      quotes: quoteRows.map((row) => {
        const quote = mapQuote(row, workspace.id);
        return {
          id: quote.id,
          requestId: quote.requestId,
          version: quote.version,
          status: quote.status,
          currency: quote.currency,
          totalMinor: quote.totalMinor,
          depositMinor: quote.depositMinor,
          balanceMinor: quote.balanceMinor,
          durationMinutes: quote.durationMinutes,
          bufferMinutes: quote.bufferMinutes,
          validUntil: quote.validUntil,
        };
      }),
      visits: rows(visitsResult.data).map((row) => ({
        id: String(row.id),
        requestId: String(row.request_id),
        quoteId: String(row.quote_id),
        status: String(row.status === "SCHEDULED" ? "CONFIRMED" : row.status === "NEEDS_REVIEW" ? "PENDING_REVIEW" : row.status),
        startAt: String(row.starts_at),
        endAt: textValue(row, "ends_at"),
      })),
      invoices: rows(invoicesResult.data).map((row) => ({
        id: String(row.id),
        quoteId: textValue(row, "quote_id"),
        visitId: textValue(row, "visit_id"),
        status: String(row.status),
        currency: String(row.currency),
        totalMinor: numberValue(row, "total_minor"),
        allocatedMinor: numberValue(row, "allocated_minor"),
        refundedMinor: numberValue(row, "refunded_minor"),
        balanceMinor: numberValue(row, "balance_minor"),
      })),
      consents: rows(consentsResult.data).map((row) => ({
        id: String(row.id),
        channel: String(row.channel),
        purpose: String(row.purpose),
        status: String(row.status),
        source: String(row.source),
        recordedAt: String(row.recorded_at),
      })),
    },
  };
}

export async function acceptCustomerPortalQuote(quoteId: string): Promise<CustomerPortalActionResult> {
  const resolved = await resolveCustomer();
  if (!resolved.ok) return { ok: false, message: resolved.message };

  const quoteResult = await resolved.value.service
    .from("quotes")
    .select("*")
    .eq("workspace_id", resolved.value.workspace.id)
    .eq("id", quoteId)
    .maybeSingle();
  if (quoteResult.error || !quoteResult.data) {
    return { ok: false, message: "The quote is no longer available." };
  }

  const requestResult = await resolved.value.service
    .from("requests")
    .select("id,customer_id")
    .eq("workspace_id", resolved.value.workspace.id)
    .eq("id", quoteResult.data.request_id)
    .maybeSingle();
  if (
    requestResult.error ||
    !requestResult.data ||
    requestResult.data.customer_id !== resolved.value.customer.id
  ) {
    return { ok: false, message: "This quote is not linked to your customer account." };
  }

  const quote = mapQuote(quoteResult.data as Row, resolved.value.workspace.id);
  if (quote.status !== "SENT") {
    return {
      ok: false,
      message:
        quote.status === "EXPIRED"
          ? "This quote has expired. Please ask the business for an updated quote."
          : "This quote cannot be accepted in its current state.",
    };
  }

  const facade = createPostgresRequestQuoteCapacityFacadeMethods(resolved.value.rpc);
  const result = await facade.acceptQuote(resolved.value.actor, quote.id, {
    idempotencyKey: "customer-quote-accept-" + crypto.randomUUID(),
    now: new Date().toISOString(),
    expectedVersion: quote.version,
  });

  return result.ok
    ? { ok: true, message: "Quote accepted. The next step is scheduling." }
    : { ok: false, message: result.message };
}
