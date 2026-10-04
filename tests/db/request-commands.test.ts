import { describe, expect, it } from "vitest";
import { createRequestRecord, updateRequestRecord } from "../../src/server/core/requests";

const now = "2026-10-04T06:00:00.000Z";
const owner = { workspaceId: "ws_a", userId: "owner1", role: "OWNER" as const };

describe("request command guards", () => {
  it("creates durable request records with owner/dispatcher scope", () => {
    const result = createRequestRecord(
      owner,
      { workspaceId: "ws_a", customerId: "cust1", propertyId: "prop1", serviceCode: "MOVE_OUT" },
      { idempotencyKey: "idem-create", now },
      () => "req1",
    );

    expect(result).toMatchObject({ ok: true, value: { id: "req1", workspaceId: "ws_a", status: "NEW", version: 1 } });
  });

  it("denies cross-tenant mutation and stale expected versions", () => {
    const created = createRequestRecord(
      owner,
      { workspaceId: "ws_a", customerId: "cust1", propertyId: "prop1", serviceCode: "MOVE_OUT" },
      { idempotencyKey: "idem-create", now },
      () => "req1",
    );
    if (!created.ok) throw new Error("fixture request was not created");

    expect(updateRequestRecord(
      { workspaceId: "ws_b", userId: "owner2", role: "OWNER" },
      created.value,
      { bedrooms: 3 },
      { idempotencyKey: "idem-cross", now, expectedVersion: 1 },
    )).toEqual({ ok: false, code: "WORKSPACE_MISMATCH", message: "Actor is not scoped to this workspace." });

    expect(updateRequestRecord(
      owner,
      created.value,
      { bedrooms: 3 },
      { idempotencyKey: "idem-stale", now, expectedVersion: 2 },
    )).toEqual({ ok: false, code: "VERSION_CONFLICT", message: "Request version changed before this command was applied." });
  });

  it("keeps anonymous visitor requests scoped to their session", () => {
    const created = createRequestRecord(
      { workspaceId: "ws_a", visitorSessionId: "visit_a", role: "VISITOR" },
      { workspaceId: "ws_a", visitorSessionId: "visit_a", serviceCode: "STANDARD" },
      { idempotencyKey: "idem-visitor", now },
      () => "req2",
    );
    if (!created.ok) throw new Error("visitor fixture request was not created");

    expect(updateRequestRecord(
      { workspaceId: "ws_a", visitorSessionId: "visit_b", role: "VISITOR" },
      created.value,
      { bathrooms: 2 },
      { idempotencyKey: "idem-wrong-visitor", now, expectedVersion: 1 },
    )).toEqual({ ok: false, code: "VISITOR_SCOPE_REQUIRED", message: "Visitor session cannot access this request." });
  });

  it("bumps versions on valid request updates", () => {
    const created = createRequestRecord(
      owner,
      { workspaceId: "ws_a", customerId: "cust1", propertyId: "prop1", serviceCode: "MOVE_OUT" },
      { idempotencyKey: "idem-create", now },
      () => "req1",
    );
    if (!created.ok) throw new Error("fixture request was not created");

    expect(updateRequestRecord(
      owner,
      created.value,
      { bedrooms: 3, bathrooms: 2 },
      { idempotencyKey: "idem-update", now, expectedVersion: 1 },
    )).toMatchObject({ ok: true, value: { version: 2, bedrooms: 3, bathrooms: 2 } });
  });
});
