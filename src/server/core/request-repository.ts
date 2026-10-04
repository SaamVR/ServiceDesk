import type { Result } from "../../contracts";
import type { RequestRecord, RequestRepository } from "./requests";

export interface RequestRow {
  id: string;
  workspace_id: string;
  customer_id: string | null;
  property_id: string | null;
  service_code: string | null;
  visitor_session_id: string | null;
  status: RequestRecord["status"];
  bedrooms: number | null;
  bathrooms: number | null;
  requested_start_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface RequestTableError {
  message: string;
  code?: string;
}

export interface RequestTableResult<T> {
  data: T | null;
  error: RequestTableError | null;
}

export interface RequestTableGateway {
  insert(row: RequestRow): Promise<RequestTableResult<RequestRow>>;
  findById(workspaceId: string, id: string): Promise<RequestTableResult<RequestRow | null>>;
  update(row: RequestRow): Promise<RequestTableResult<RequestRow>>;
}

function repositoryError(error: RequestTableError): Result<never> {
  return { ok: false, code: "REQUEST_REPOSITORY_ERROR", message: error.message };
}

function notFound(): Result<never> {
  return { ok: false, code: "REQUEST_NOT_FOUND", message: "Request was not found in this workspace." };
}

export function mapRequestRowToRecord(row: RequestRow): RequestRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    customerId: row.customer_id ?? undefined,
    propertyId: row.property_id ?? undefined,
    serviceCode: row.service_code ?? undefined,
    visitorSessionId: row.visitor_session_id ?? undefined,
    status: row.status,
    bedrooms: row.bedrooms ?? undefined,
    bathrooms: row.bathrooms ?? undefined,
    requestedStartAt: row.requested_start_at ?? undefined,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRequestRecordToRow(record: RequestRecord): RequestRow {
  return {
    id: record.id,
    workspace_id: record.workspaceId,
    customer_id: record.customerId ?? null,
    property_id: record.propertyId ?? null,
    service_code: record.serviceCode ?? null,
    visitor_session_id: record.visitorSessionId ?? null,
    status: record.status,
    bedrooms: record.bedrooms ?? null,
    bathrooms: record.bathrooms ?? null,
    requested_start_at: record.requestedStartAt ?? null,
    version: record.version,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function createPostgresRequestRepository(gateway: RequestTableGateway): RequestRepository {
  return {
    async insert(request) {
      const result = await gateway.insert(mapRequestRecordToRow(request));
      if (result.error) return repositoryError(result.error);
      if (!result.data) return notFound();
      return { ok: true, value: mapRequestRowToRecord(result.data) };
    },

    async findById(workspaceId, id) {
      const result = await gateway.findById(workspaceId, id);
      if (result.error) return repositoryError(result.error);
      if (!result.data) return notFound();
      return { ok: true, value: mapRequestRowToRecord(result.data) };
    },

    async update(request) {
      const result = await gateway.update(mapRequestRecordToRow(request));
      if (result.error) return repositoryError(result.error);
      if (!result.data) return notFound();
      return { ok: true, value: mapRequestRowToRecord(result.data) };
    },
  };
}
