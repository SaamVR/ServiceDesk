import type { ActorContext, CommandMeta, QuoteDTO, RequestDTO, Result, SlotDTO } from "../../contracts";
import { createQuoteSnapshot, type QuoteServiceCode, type RateCard } from "../../domain/quote";
import type { ServiceDeskFacade, CreateRequestInput, FindSlotsInput } from "./facade";
import type { SupabaseRpcClient } from "./payment-application-postgres";

type RpcRow = Record<string, unknown>;

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function rpcResult<T>(data: RpcRow | null, error: { message: string; code?: string } | null, fallback: string, map: (row: RpcRow) => T): Result<T> {
  if (error) return fail(error.code ?? fallback, error.message);
  if (!data || data.ok === false) return fail(String(data?.code ?? fallback), "Database command rejected the request.");
  try {
    return { ok: true, value: map(data) };
  } catch (cause) {
    return fail(fallback, cause instanceof Error ? cause.message : "Malformed database response.");
  }
}

function field(row: RpcRow, camel: string, snake?: string): unknown {
  return row[camel] ?? (snake ? row[snake] : undefined);
}

function object(value: unknown): RpcRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Malformed RPC object.");
  return value as RpcRow;
}

function maybeString(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}

function requestFromRpc(value: unknown): RequestDTO {
  const row = object(value);
  return {
    id: String(field(row, "id")),
    workspaceId: String(field(row, "workspaceId", "workspace_id")),
    customerId: maybeString(field(row, "customerId", "customer_id")),
    propertyId: maybeString(field(row, "propertyId", "property_id")),
    serviceCode: maybeString(field(row, "serviceCode", "service_code")),
    status: String(field(row, "status")) as RequestDTO["status"],
    bedrooms: typeof field(row, "bedrooms") === "number" ? Number(field(row, "bedrooms")) : undefined,
    bathrooms: typeof field(row, "bathrooms") === "number" ? Number(field(row, "bathrooms")) : undefined,
    requestedStartAt: maybeString(field(row, "requestedStartAt", "requested_start_at")),
    version: Number(field(row, "version") ?? 0),
    createdAt: String(field(row, "createdAt", "created_at")),
    updatedAt: String(field(row, "updatedAt", "updated_at")),
  };
}

function quoteFromRpc(value: unknown, expectedWorkspaceId: string): QuoteDTO {
  const row = object(value);
  const text = (camel: string, snake?: string): string => {
    const saved = field(row, camel, snake);
    if (typeof saved !== "string" || !saved.trim())
      throw new Error("Malformed persisted quote identity or status.");
    return saved;
  };
  const amount = (camel: string, snake: string): number => {
    const saved = field(row, camel, snake);
    if (typeof saved !== "number" || !Number.isSafeInteger(saved) || saved < 0)
      throw new Error("Malformed persisted quote monetary or duration evidence.");
    return saved;
  };
  const status = text("status");
  const currency = text("currency");
  const validUntil = text("validUntil", "valid_until");
  if (!["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT",
        "ACCEPTED", "DECLINED", "EXPIRED", "SUPERSEDED"].includes(status) ||
      !/^[A-Z]{3}$/.test(currency) ||
      !/(?:Z|[+-]\d{2}:\d{2})$/i.test(validUntil) ||
      !Number.isFinite(Date.parse(validUntil)))
    throw new Error("Malformed persisted quote lifecycle, currency or validity.");
  const totalMinor = amount("totalMinor", "total_minor");
  const subtotalMinor = amount("subtotalMinor", "subtotal_minor");
  const taxMinor = amount("taxMinor", "tax_minor");
  const depositMinor = amount("depositMinor", "deposit_minor");
  const balanceMinor = amount("balanceMinor", "balance_minor");
  const version = amount("version", "version");
  if (version < 1 || !Number.isSafeInteger(subtotalMinor + taxMinor) ||
      !Number.isSafeInteger(depositMinor + balanceMinor) ||
      subtotalMinor + taxMinor !== totalMinor ||
      depositMinor + balanceMinor !== totalMinor)
    throw new Error("Malformed persisted quote financial reconciliation.");
  const workspaceId = text("workspaceId", "workspace_id");
  if (workspaceId !== expectedWorkspaceId)
    throw new Error("Quote RPC scope mismatch.");
  return {
    id: text("id"), workspaceId,
    requestId: text("requestId", "request_id"),
    version, status: status as QuoteDTO["status"], currency,
    subtotalMinor, taxMinor, totalMinor, depositMinor, balanceMinor,
    durationMinutes: amount("durationMinutes", "duration_minutes"),
    bufferMinutes: amount("bufferMinutes", "buffer_minutes"),
    rateVersion: text("rateVersion", "rate_version"), validUntil,
  };
}

function requirePersistedText(row: RpcRow, camel: string, snake?: string): string {
  const value = field(row, camel, snake);
  if (typeof value !== "string" || !value.trim())
    throw new Error("Malformed capacity or hold source identity.");
  return value;
}
function requirePersistedInstant(row: RpcRow, camel: string, snake?: string): string {
  const value = requirePersistedText(row, camel, snake);
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ||
      !Number.isFinite(Date.parse(value)))
    throw new Error("Malformed capacity or hold expiry timestamp.");
  return value;
}
function slotFromRpc(value: unknown, quote: QuoteDTO): SlotDTO {
  const row = object(value);
  const workspaceId = requirePersistedText(row,"workspaceId","workspace_id");
  const startAt = requirePersistedInstant(row,"startAt","starts_at");
  const endAt = requirePersistedInstant(row,"endAt","ends_at");
  if (workspaceId !== quote.workspaceId || Date.parse(endAt) <= Date.parse(startAt))
    throw new Error("Malformed capacity slot workspace or interval.");
  return {
    id: requirePersistedText(row,"id"), workspaceId,
    crewId: requirePersistedText(row,"crewId","crew_id"),
    startAt, endAt,
    serviceMinutes: quote.durationMinutes,
    bufferMinutes: quote.bufferMinutes,
    availabilityFresh: true,
  };
}

function actor(ctx: ActorContext): RpcRow {
  return {
    workspaceId: ctx.workspaceId,
    actorRole: ctx.role,
    actorUserId: ctx.userId,
    actorVisitorSessionId: ctx.visitorSessionId,
  };
}

async function readRequest(client: SupabaseRpcClient, ctx: ActorContext, requestId: string): Promise<Result<RequestDTO>> {
  const { data, error } = await client.rpc<RpcRow>("servicedesk_get_request", { p_input: { ...actor(ctx), requestId } });
  return rpcResult(data, error, "REQUEST_RPC_ERROR", (row) => requestFromRpc(row.request));
}

async function readQuote(client: SupabaseRpcClient, ctx: ActorContext, quoteId: string): Promise<Result<QuoteDTO>> {
  const { data, error } = await client.rpc<RpcRow>("servicedesk_get_quote", { p_input: { ...actor(ctx), quoteId } });
  return rpcResult(data, error, "QUOTE_RPC_ERROR", (row) => quoteFromRpc(row.quote, ctx.workspaceId));
}

async function readLatestQuoteForRequest(client: SupabaseRpcClient, ctx: ActorContext, requestId: string): Promise<Result<QuoteDTO>> {
  const { data, error } = await client.rpc<RpcRow>("servicedesk_get_latest_quote_for_request", { p_input: { ...actor(ctx), requestId } });
  return rpcResult(data, error, "QUOTE_RPC_ERROR", (row) => quoteFromRpc(row.quote, ctx.workspaceId));
}

function supportedService(value: string | undefined): value is QuoteServiceCode {
  return value === "MOVE_OUT" || value === "STANDARD" || value === "DEEP";
}

export interface CustomerBootstrapInput { displayName: string; authUserId?: string; leadSource?: string; notes?: string; }
export interface PropertyBootstrapInput { customerId: string; label?: string; addressLine1: string; addressLine2?: string; city: string; region?: string; postalCode: string; countryCode?: string; serviceNotes?: string; accessNotes?: string; }
export interface CapacitySlotSeedInput { slotId?: string; crewId: string; startsAt: string; endsAt: string; capacityMinutes: number; timezone?: string; }

export function createPostgresRequestQuoteCapacityFacadeMethods(
  client: SupabaseRpcClient,
  persistedRateCard?: RateCard,
  humanConfirmedAddons?: { oven?: boolean },
): Pick<ServiceDeskFacade, "createRequest" | "updateRequest" | "calculateQuote" | "sendQuote" | "acceptQuote" | "findSlots" | "holdSlot"> {
  return {
    async createRequest(ctx: ActorContext, input: CreateRequestInput, meta: CommandMeta): Promise<Result<RequestDTO>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_create_request", {
        p_input: { ...actor(ctx), ...input, visitorSessionId: ctx.role === "VISITOR" ? ctx.visitorSessionId : undefined, idempotencyKey: meta.idempotencyKey, now: meta.now },
      });
      return rpcResult(data, error, "REQUEST_CREATE_RPC_ERROR", (row) => requestFromRpc(row.request));
    },

    async updateRequest(ctx: ActorContext, id: string, patch: Partial<RequestDTO>, meta: CommandMeta): Promise<Result<RequestDTO>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_update_request", {
        p_input: { ...actor(ctx), requestId: id, ...patch, idempotencyKey: meta.idempotencyKey, expectedVersion: meta.expectedVersion, now: meta.now },
      });
      return rpcResult(data, error, "REQUEST_UPDATE_RPC_ERROR", (row) => requestFromRpc(row.request));
    },

    async calculateQuote(ctx: ActorContext, requestId: string): Promise<Result<QuoteDTO>> {
      // There is no acceptable default for real customer pricing. The caller
      // must first resolve its active, tenant-scoped branch price book.
      if (!persistedRateCard) return fail("QUOTE_RATE_CARD_REQUIRED", "Configure an approved branch rate card before quoting.");
      const request = await readRequest(client, ctx, requestId);
      if (request.ok === false) return request;
      if (!supportedService(request.value.serviceCode)) return fail("REQUEST_SERVICE_REQUIRED", "Request needs a supported service before quoting.");
      if (request.value.bedrooms === undefined || request.value.bathrooms === undefined) return fail("REQUEST_ROOMS_REQUIRED", "Request needs bedroom and bathroom counts before quoting.");

      const snapshot = createQuoteSnapshot({
        id: crypto.randomUUID(),
        workspaceId: ctx.workspaceId,
        requestId,
        serviceCode: request.value.serviceCode,
        bedrooms: request.value.bedrooms,
        bathrooms: request.value.bathrooms,
        // A move-out request is not add-on consent. Only a separate
        // human-confirmed checkbox passed by the authorized server action
        // can add an oven charge at the owner-configured rate.
        oven: request.value.serviceCode === "MOVE_OUT" &&
          humanConfirmedAddons?.oven === true,
        now: new Date().toISOString(),
      }, persistedRateCard);

      const { data, error } = await client.rpc<RpcRow>("servicedesk_persist_quote_snapshot", {
        p_input: { ...actor(ctx), requestId, quoteId: snapshot.id, snapshot },
      });
      return rpcResult(data, error, "QUOTE_PERSIST_RPC_ERROR", (row) => quoteFromRpc(row.quote, ctx.workspaceId));
    },

    async sendQuote(ctx: ActorContext, id: string, meta: CommandMeta): Promise<Result<QuoteDTO>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_send_quote", { p_input: { ...actor(ctx), quoteId: id, expectedVersion: meta.expectedVersion, idempotencyKey: meta.idempotencyKey, now: meta.now } });
      return rpcResult(data, error, "QUOTE_SEND_RPC_ERROR", (row) => quoteFromRpc(row.quote, ctx.workspaceId));
    },

    async acceptQuote(ctx: ActorContext, id: string, meta: CommandMeta): Promise<Result<QuoteDTO>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_accept_quote", { p_input: { ...actor(ctx), quoteId: id, expectedVersion: meta.expectedVersion, idempotencyKey: meta.idempotencyKey, now: meta.now } });
      return rpcResult(data, error, "QUOTE_ACCEPT_RPC_ERROR", (row) => quoteFromRpc(row.quote, ctx.workspaceId));
    },

    async findSlots(ctx: ActorContext, input: FindSlotsInput): Promise<SlotDTO[]> {
      const quote = await readLatestQuoteForRequest(client, ctx, input.requestId);
      if (quote.ok === false) return [];
      const { data, error } = await client.rpc<RpcRow>("servicedesk_find_capacity_slots", { p_input: { ...actor(ctx), ...input } });
      if (error || !data || data.ok === false || !Array.isArray(data.slots) ||
          quote.value.requestId !== input.requestId) return [];
      // A corrupt slot source must not turn into a convincing available slot.
      // Preserve the current facade's [] failure contract instead of throwing.
      try { return data.slots.map((slot) => slotFromRpc(slot, quote.value)); }
      catch { return []; }
    },

    async holdSlot(ctx: ActorContext, slotId: string, quoteId: string, meta: CommandMeta): Promise<Result<{ holdId: string; expiresAt: string }>> {
      const { data, error } = await client.rpc<RpcRow>("servicedesk_hold_slot", { p_input: { ...actor(ctx), slotId, quoteId, idempotencyKey: meta.idempotencyKey, now: meta.now } });
      return rpcResult(data, error, "HOLD_SLOT_RPC_ERROR", (row) => {
        const hold = object(row.hold);
        const holdId = requirePersistedText(hold, "id");
        const expiresAt = requirePersistedInstant(hold, "expiresAt", "expires_at");
        if (!Number.isFinite(Date.parse(meta.now)) ||
            Date.parse(expiresAt) <= Date.parse(meta.now))
          throw new Error("Persisted hold expiry is not in the future.");
        return { holdId, expiresAt };
      });
    },
  };
}

export function createPostgresRequestQuoteCapacityInternalCommands(client: SupabaseRpcClient) {
  return {
    async createCustomer(ctx: ActorContext, input: CustomerBootstrapInput, meta: CommandMeta) {
      return client.rpc("servicedesk_create_customer", { p_input: { ...actor(ctx), ...input, idempotencyKey: meta.idempotencyKey, now: meta.now } });
    },
    async createProperty(ctx: ActorContext, input: PropertyBootstrapInput, meta: CommandMeta) {
      return client.rpc("servicedesk_create_property", { p_input: { ...actor(ctx), ...input, idempotencyKey: meta.idempotencyKey, now: meta.now } });
    },
    async seedCapacitySlot(ctx: ActorContext, input: CapacitySlotSeedInput, meta: CommandMeta) {
      return client.rpc("servicedesk_upsert_capacity_slot", { p_input: { ...actor(ctx), ...input, idempotencyKey: meta.idempotencyKey, now: meta.now } });
    },
  };
}


export function createPostgresRequestQuoteCapacityCommandEntrypoints(client: SupabaseRpcClient) {
  const facade = createPostgresRequestQuoteCapacityFacadeMethods(client);
  return {
    createRequestCommand: (ctx: ActorContext, input: CreateRequestInput, meta: CommandMeta) => facade.createRequest(ctx, input, meta),
    updateRequestCommand: (ctx: ActorContext, requestId: string, patch: Partial<RequestDTO>, meta: CommandMeta) => facade.updateRequest(ctx, requestId, patch, meta),
    calculateQuoteCommand: (ctx: ActorContext, requestId: string) => facade.calculateQuote(ctx, requestId),
    sendQuoteCommand: (ctx: ActorContext, quoteId: string, meta: CommandMeta) => facade.sendQuote(ctx, quoteId, meta),
    acceptQuoteCommand: (ctx: ActorContext, quoteId: string, meta: CommandMeta) => facade.acceptQuote(ctx, quoteId, meta),
    findSlotsCommand: (ctx: ActorContext, input: FindSlotsInput) => facade.findSlots(ctx, input),
    holdSlotCommand: (ctx: ActorContext, slotId: string, quoteId: string, meta: CommandMeta) => facade.holdSlot(ctx, slotId, quoteId, meta),
  };
}
