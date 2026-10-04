import { describe, expect, it } from "vitest";
import { createRequestFacadeMethods } from "../../src/server/core/request-facade";
import type { RequestRecord, RequestRepository } from "../../src/server/core/requests";

const now = "2026-10-04T06:00:00.000Z";
const visitor = { workspaceId: "ws_1", visitorSessionId: "visitor_1", role: "VISITOR" as const };

function repo(): RequestRepository {
  const records: RequestRecord[] = [];
  return {
    insert: async (request) => { records.push(request); return { ok: true, value: request }; },
    findById: async (workspaceId, id) => {
      const found = records.find((record) => record.workspaceId === workspaceId && record.id === id);
      return found ? { ok: true, value: found } : { ok: false, code: "REQUEST_NOT_FOUND", message: "Request was not found in this workspace." };
    },
    update: async (request) => { records[records.findIndex((record) => record.id === request.id)] = request; return { ok: true, value: request }; },
  };
}

describe("request facade", () => {
  it("creates and updates request DTOs without exposing visitor session", async () => {
    const facade = createRequestFacadeMethods({ requestRepository: repo(), nextRequestId: () => "req_1" });
    const created = await facade.createRequest(visitor, { serviceCode: "STANDARD" }, { idempotencyKey: "create", now });
    expect(created).toMatchObject({ ok: true, value: { id: "req_1", workspaceId: "ws_1", serviceCode: "STANDARD", version: 1 } });
    if (!created.ok) throw new Error("create failed");
    expect("visitorSessionId" in created.value).toBe(false);
    await expect(facade.updateRequest(visitor, created.value.id, { bedrooms: 2 }, { idempotencyKey: "update", now, expectedVersion: 1 })).resolves.toMatchObject({ ok: true, value: { bedrooms: 2, version: 2 } });
  });
});
