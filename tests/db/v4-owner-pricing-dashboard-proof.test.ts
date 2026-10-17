import { describe, expect, it } from "vitest";
import { defaultRateCard } from "../../src/domain/quote";
import { verifiedPricedOwnerBranchIds } from "../../src/features/operations/verified-owner-price-evidence";

const branch = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const cardId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const svcId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const now = Date.parse("2026-10-17T08:00:00Z");
const card = {
  id: cardId, version: "owner-approved-v20", active: true, currency: "USD",
  deposit_percent: 25, valid_hours: 48, buffer_minutes: 30,
  rules: {
    autoApprovalMaxTotalMinor: defaultRateCard.autoApprovalMaxTotalMinor,
    standard: defaultRateCard.standard,
    deep: defaultRateCard.deep,
    moveOut: defaultRateCard.moveOut,
  },
};
const book = {
  branch_id: branch, rate_card_id: cardId, active: true,
  starts_at: null, ends_at: null,
};
const service = { id: svcId, active: true, code: "STANDARD" };
const given = { books: [book], cards: [card], services: [service], now };
const check = (patch: { books?: Record<string, unknown>[]; cards?: Record<string, unknown>[];\n  services?: Record<string, unknown>[]; now?: number } = {}) =>
  verifiedPricedOwnerBranchIds({ ...given, ...patch });

describe("owner dashboard saved pricing agrees with the server quote source", () => {
  it("labels a branch only after reading a complete active USD owner card with a supported service", () => {
    expect(check()).toEqual([branch]);
    expect(check({ services: [] })).toEqual([]);
    expect(check({ services: [{ ...service, active: false }] })).toEqual([]);
  });

  it("rejects active price books pointing to missing, synthetic, partial, or invalid real price cards", () => {
    const cardVariants = [
      { ...card, version: "synthetic-cleaning-v1" },
      { ...card, version: " owner-approved-v20" },
      { ...card, active: false },
      { ...card, currency: " USD" },
      { ...card, currency: "GBP" },
      { ...card, deposit_percent: 101 },
      { ...card, valid_hours: 0 },
      { ...card, buffer_minutes: 1441 },
      { ...card, rules: { standard: { baseMinor: 1000, baseMinutes: 60 } } },
      { ...card, rules: { ...card.rules, moveOut: { ...card.rules.moveOut, ovenMinor: undefined } } },
      { ...card, rules: { ...card.rules, deep: { ...card.rules.deep, baseMinor: 0 } } },
      { ...card, rules: { ...card.rules, autoApprovalMaxTotalMinor: "50000" } },
    ];
    for (const invalid of cardVariants) {
      expect(check({ cards: [invalid] }), JSON.stringify(invalid)).toEqual([]);
    }
    expect(check({ cards: [] })).toEqual([]);
    expect(check({ books: [{ ...book, rate_card_id: svcId }] })).toEqual([]);
  });

  it("does not hide overlapping active price books or duplicate a branch into false readiness", () => {
    expect(check({ books: [book, { ...book }] })).toEqual([]);
    expect(check({ books: [
      book, { ...book, rate_card_id: svcId },
    ] })).toEqual([]);
    // A future valid book does not conflict with exactly one current book.
    expect(check({ books: [book, { ...book, starts_at: "2030-01-01T00:00:00Z" }] }))
      .toEqual([branch]);
    expect(check({ books: [{ ...book, active: false }] })).toEqual([]);
  });

  it("does not omit corrupt or contradictory active window records from uniqueness checks", () => {
    for (const invalid of [
      "2026-02-30T10:00:00Z",
      "2026-10-17",
      "2026-10-17T10:00:00",
      "2026-10-17T10:00:00+15:00",
      "invalid",
      undefined,
      {},
    ]) {
      expect(check({ books: [book, { ...book, starts_at: invalid }] }))
        .toEqual([]);
    }
    expect(check({ books: [{ ...book, starts_at: "2026-11-01T00:00:00Z",
      ends_at: "2026-10-01T00:00:00Z" }] })).toEqual([]);
    expect(check({ books: [{ ...book, starts_at: "2030-01-01T00:00:00Z" }] }))
      .toEqual([]);
    expect(check({ books: [{ ...book, ends_at: "2020-01-01T00:00:00Z" }] }))
      .toEqual([]);
    expect(check({ now: Number.NaN })).toEqual([]);
  });

  it("refuses more than 100 active records for one branch, matching bounded quote authority", () => {
    expect(check({ books: Array.from({ length: 101 }, (_, i) => ({
      ...book, starts_at: i ? "2030-01-01T00:00:00Z" : null,
    })) })).toEqual([]);
  });
});
