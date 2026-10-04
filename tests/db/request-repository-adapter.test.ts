import { describe, expect, it } from "vitest";
import type { RequestRecord } from "../../src/server/core/requests";
import {
  createPostgresRequestRepository,
  mapRequestRecordToRow,
  mapRequestRowToRecord,
  type RequestRow,
  type RequestTableGateway,
} from "../../src/server/core/request-repository";

const now = "2026-10-04T06:40:00.000Z";

const record: RequestRecord = {
  id: "req1",
  workspaceId: "ws_a",
  customerId: "cust1",
  propertyId: "prop1",
  serviceCode: "MOVE_OUT",
  visitorSessionId: undefined,
  status: "NEW",
  bedrooms: 3,
  bathrooms: 2,
  requestedStartAt: "2026-10-10T09:00:00.000Z",
  version: 1,
  createdAt: now,
  updatedAt: now,
};

function memoryGateway(seed: RequestRow[] = []): RequestTableGateway {
  const rows = new Map(seed.map((row) => [`${row.workspace_id}:${row.id}`, row]));

  return {
    async insert(row) {
      rows.set(`${row.workspace_id}:${row.id}`, row);
      return { data: row, error: null };
    },
    async findById(workspaceId, id) {
      return { data: rows.get(`${workspaceId}:${id}`) ?? null, error: null };
    },
    async update(row) {
      rows.set(`${row.workspace_id}:${row.id}`, row);
      return { data: row, error: null };
    },
  };
}

describe("request persistence adapter", () => {
  it("maps request records to database rows and back without losing tenant scope", () => {
    const row = mapRequestRecordToRow(record);

    expect(row).toMatchObject({
      id: "req1",
      workspace_id: "ws_a",
      customer_id: "cust1",
      property_id: "prop1",
      service_code: "MOVE_OUT",
      requested_start_at: "2026-10-10T09:00:00.000Z",
    });
    expect(mapRequestRowToRecord(row)).toEqual(record);
  });

  it("persists and reloads request records through the table gateway", async () => {
    const repository = createPostgresRequestRepository(memoryGateway());

    await expect(repository.insert(record, { idempotencyKey: "idem-insert", now })).resolves.toEqual({ ok: true, value: record });
    await expect(repository.findById("ws_a", "req1")).resolves.toEqual({ ok: true, value: record });
    await expect(repository.findById("ws_b", "req1")).resolves.toEqual({
      ok: false,
      code: "REQUEST_NOT_FOUND",
      message: "Request was not found in this workspace.",
    });
  });

  it("translates storage errors into typed Result failures", async () => {
    const repository = createPostgresRequestRepository({
      async insert() { return { data: null, error: { message: "duplicate key", code: "23505" } }; },
      async findById() { return { data: null, error: { message: "db unavailable" } }; },
      async update() { return { data: null, error: { message: "version conflict" } }; },
    });

    await expect(repository.insert(record, { idempotencyKey: "idem-error", now })).resolves.toEqual({
      ok: false,
      code: "REQUEST_REPOSITORY_ERROR",
      message: "duplicate key",
    });
    await expect(repository.findById("ws_a", "req1")).resolves.toEqual({
      ok: false,
      code: "REQUEST_REPOSITORY_ERROR",
      message: "db unavailable",
    });
  });
});
