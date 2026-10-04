import { describe, expect, it } from "vitest";
import type { CommandMeta, Result } from "../../src/contracts";
import {
  createRequestWithRepository,
  updateRequestWithRepository,
  type RequestRecord,
  type RequestRepository,
} from "../../src/server/core/requests";

const now = "2026-10-04T06:20:00.000Z";
const meta: CommandMeta = { idempotencyKey: "idem-repo", now };
const owner = { workspaceId: "ws_a", userId: "owner1", role: "OWNER" as const };

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function memoryRepository(seed: RequestRecord[] = []): RequestRepository {
  const records = new Map(seed.map((record) => [`${record.workspaceId}:${record.id}`, record]));

  return {
    async insert(request) {
      records.set(`${request.workspaceId}:${request.id}`, request);
      return ok(request);
    },
    async findById(workspaceId, id) {
      const record = records.get(`${workspaceId}:${id}`);
      if (!record) return { ok: false, code: "REQUEST_NOT_FOUND", message: "Request was not found in this workspace." };
      return ok(record);
    },
    async update(request) {
      records.set(`${request.workspaceId}:${request.id}`, request);
      return ok(request);
    },
  };
}

describe("request repository command wrappers", () => {
  it("persists newly created request records through the repository port", async () => {
    const repo = memoryRepository();

    const result = await createRequestWithRepository(
      owner,
      { workspaceId: "ws_a", customerId: "cust1", propertyId: "prop1", serviceCode: "MOVE_OUT" },
      meta,
      repo,
      () => "req1",
    );

    expect(result).toMatchObject({ ok: true, value: { id: "req1", workspaceId: "ws_a", version: 1 } });
    await expect(repo.findById("ws_a", "req1")).resolves.toMatchObject({ ok: true, value: { serviceCode: "MOVE_OUT" } });
  });

  it("loads, authorizes and saves request updates without exposing another workspace", async () => {
    const existing: RequestRecord = {
      id: "req1",
      workspaceId: "ws_a",
      customerId: "cust1",
      propertyId: "prop1",
      serviceCode: "MOVE_OUT",
      status: "NEW",
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const repo = memoryRepository([existing]);

    await expect(updateRequestWithRepository(
      owner,
      "req1",
      { bedrooms: 3, bathrooms: 2 },
      { ...meta, expectedVersion: 1 },
      repo,
    )).resolves.toMatchObject({ ok: true, value: { id: "req1", version: 2, bedrooms: 3, bathrooms: 2 } });

    await expect(updateRequestWithRepository(
      { workspaceId: "ws_b", userId: "owner2", role: "OWNER" },
      "req1",
      { bedrooms: 4 },
      { ...meta, expectedVersion: 2 },
      repo,
    )).resolves.toEqual({ ok: false, code: "REQUEST_NOT_FOUND", message: "Request was not found in this workspace." });
  });
});
