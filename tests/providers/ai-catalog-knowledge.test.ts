import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActorContext } from "../../src/contracts";
import { loadApprovedCatalogKnowledge } from "../../src/server/ai/catalog-knowledge";

const actor = { workspaceId: "ws-1", role: "OWNER", userId: "owner-1" } as ActorContext;
const active = { id: "service-1", workspace_id: "ws-1", code: "DEEP",
  name: "Deep cleaning", active: true, requires_review: true,
  updated_at: "2026-10-11T03:00:00Z" };
function gateway(data: unknown, error: unknown = null) {
  const filters: Array<[string, unknown]> = [];
  const query = {
    eq(column: string, value: unknown) { filters.push([column, value]); return this; },
    async limit(n: number) { expect(n).toBe(101); return { data, error }; },
  };
  const service = { from: (name: string) => {
    expect(name).toBe("service_catalog");
    return { select: () => query };
  } } as unknown as Pick<SupabaseClient, "from">;
  return { service, filters };
}
describe("live tenant service catalog for AI", () => {
  it("loads approved active services and retains mandatory dispatcher review", async () => {
    const query = gateway([active]);
    const result = await loadApprovedCatalogKnowledge(query.service, "ws-1");
    expect(result.ok).toBe(true);
    expect(query.filters).toEqual([["workspace_id", "ws-1"], ["active", true]]);
    if (!result.ok) return;
    const found = result.value.searchApprovedKnowledge(actor, "deep cleaning");
    if (!found.ok) throw new Error("Expected authorized knowledge search");
    expect(found.value[0].citation).toMatchObject({
      documentId: "service-catalog:service-1", chunkId: "active-service:DEEP",
    });
    expect(found.value[0].snippet).toContain("Human dispatcher review is REQUIRED");
  });

  it("accepts empty catalogs without fallback fixture knowledge", async () => {
    const loaded = await loadApprovedCatalogKnowledge(gateway([]).service, "ws-1");
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.searchApprovedKnowledge(actor, "deep cleaning"))
        .toMatchObject({ ok: true, value: [] });
    }
  });

  it("rejects tenant mismatch, inactive rows, duplicate IDs and malformed review policy", async () => {
    const badRows = [
      [{ ...active, workspace_id: "ws-2" }],
      [{ ...active, active: false }],
      [active, active],
      [{ ...active, name: " " }],
      [{ ...active, requires_review: null }],
      Array.from({ length: 101 }, (_, i) => ({ ...active, id: "service-" + i })),
    ];
    for (const rows of badRows) {
      expect((await loadApprovedCatalogKnowledge(gateway(rows).service, "ws-1")).ok)
        .toBe(false);
    }
  });

  it("does not return untrusted database error bodies to a caller", async () => {
    const result = await loadApprovedCatalogKnowledge(gateway(null, { message: "db failure detail" }).service, "ws-1");
    expect(result).toMatchObject({ ok: false, code: "AI_CATALOG_READ_FAILED" });
    expect(JSON.stringify(result)).not.toContain("db failure detail");
  });

  it("rejects invalid workspace identity", async () => {
    const result = await loadApprovedCatalogKnowledge(gateway([active]).service, "../wrong");
    expect(result).toMatchObject({ ok: false, code: "AI_CATALOG_WORKSPACE_INVALID" });
  });
});
