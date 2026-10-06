import { describe, expect, it, vi } from "vitest";
import { createPostgresTaxProfilePort } from "../../src/server/core/tax-profile-postgres";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const owner = { workspaceId: "workspace-1", userId: "owner-1", role: "OWNER" as const };

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: "tax-1",
    workspaceId: "workspace-1",
    jurisdictionCode: "US-CA",
    taxCode: "LOCAL",
    rateBasisPoints: 825,
    priceIncludesTax: false,
    status: "DRAFT",
    provenanceKind: "ACCOUNTANT_GUIDANCE",
    provenanceReference: "2026 tax review note",
    effectiveFrom: "2026-10-01",
    version: 1,
    createdAt: "2026-10-07T00:00:00.000Z",
    updatedAt: "2026-10-07T00:00:00.000Z",
    ...overrides,
  };
}

describe("tax profile postgres boundary", () => {
  it("maps a reference-only staff snapshot", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        snapshot: {
          workspaceId: "workspace-1",
          automaticApplicationEnabled: false,
          profiles: [profile()],
        },
      },
      error: null,
    });
    const port = createPostgresTaxProfilePort({ rpc } as SupabaseRpcClient);
    const result = await port.readTaxProfileSnapshot(owner);

    expect(result).toMatchObject({
      ok: true,
      value: {
        automaticApplicationEnabled: false,
        profiles: [{ status: "DRAFT", rateBasisPoints: 825 }],
      },
    });
  });

  it("rejects any payload that attempts to claim automatic application", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        snapshot: {
          workspaceId: "workspace-1",
          automaticApplicationEnabled: true,
          profiles: [],
        },
      },
      error: null,
    });
    const port = createPostgresTaxProfilePort({ rpc } as SupabaseRpcClient);
    const result = await port.readTaxProfileSnapshot(owner);

    expect(result).toMatchObject({ ok: false, code: "TAX_PROFILE_READ_MALFORMED" });
  });

  it("blocks dispatcher mutation before calling the database", async () => {
    const rpc = vi.fn();
    const port = createPostgresTaxProfilePort({ rpc } as SupabaseRpcClient);
    const result = await port.upsertTaxProfile(
      { workspaceId: "workspace-1", userId: "dispatcher-1", role: "DISPATCHER" },
      {
        jurisdictionCode: "US-CA",
        taxCode: "LOCAL",
        rateBasisPoints: 825,
        priceIncludesTax: false,
        provenanceKind: "ACCOUNTANT_GUIDANCE",
        provenanceReference: "2026 tax review note",
        effectiveFrom: "2026-10-01",
        now: "2026-10-07T00:00:00.000Z",
      },
    );

    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("records review through the owner-only RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, profile: profile({ status: "REVIEWED", version: 2, reviewedByUserId: "owner-1", reviewedAt: "2026-10-07T01:00:00.000Z" }) },
      error: null,
    });
    const port = createPostgresTaxProfilePort({ rpc } as SupabaseRpcClient);
    const result = await port.reviewTaxProfile(owner, {
      profileId: "tax-1",
      expectedVersion: 1,
      accountantReviewConfirmed: true,
      reviewAttestation: "Reviewed against accountant guidance.",
      now: "2026-10-07T01:00:00.000Z",
    });

    expect(result).toMatchObject({ ok: true, value: { status: "REVIEWED", version: 2 } });
    expect(rpc).toHaveBeenCalledWith(
      "servicedesk_review_tax_profile",
      { p_input: expect.objectContaining({ actorRole: "OWNER", accountantReviewConfirmed: true }) },
    );
  });
});
