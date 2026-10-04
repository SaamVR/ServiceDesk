import type { PropertyDTO, Result } from "../../contracts";

export interface PropertyRow {
  id: string;
  workspace_id: string;
  customer_id: string;
  label: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  region: string | null;
  postal_code: string;
  country_code: string;
  access_notes: string | null;
  service_notes: string | null;
  version: number;
  archived_at: string | null;
}

export interface PropertyTableError { message: string; code?: string; }
export interface PropertyTableResult<T> { data: T | null; error: PropertyTableError | null; }
export interface PropertyTableGateway {
  listActiveByCustomer(workspaceId: string, customerId: string): Promise<PropertyTableResult<PropertyRow[]>>;
}

export interface PropertyRepository {
  listActiveByCustomer(workspaceId: string, customerId: string): Promise<Result<PropertyDTO[]>>;
}

function repositoryError(error: PropertyTableError): Result<never> {
  return { ok: false, code: "PROPERTY_REPOSITORY_ERROR", message: error.message };
}

function failClosed(): Result<never> {
  return { ok: false, code: "PROPERTY_SCOPE_MISMATCH", message: "Property row was outside the requested workspace or customer scope." };
}

export function mapPropertyRowToDTO(row: PropertyRow): PropertyDTO {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    customerId: row.customer_id,
    label: row.label ?? undefined,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2 ?? undefined,
    city: row.city,
    region: row.region ?? undefined,
    postalCode: row.postal_code,
    countryCode: row.country_code,
    serviceNotes: row.service_notes ?? undefined,
    accessNotes: row.access_notes ?? undefined,
    version: row.version,
  };
}

export function createPostgresPropertyRepository(gateway: PropertyTableGateway): PropertyRepository {
  return {
    async listActiveByCustomer(workspaceId, customerId) {
      const result = await gateway.listActiveByCustomer(workspaceId, customerId);
      if (result.error) return repositoryError(result.error);
      const rows = result.data ?? [];
      if (rows.some((row) => row.workspace_id !== workspaceId || row.customer_id !== customerId || row.archived_at !== null)) {
        return failClosed();
      }
      return { ok: true, value: rows.map(mapPropertyRowToDTO) };
    },
  };
}
