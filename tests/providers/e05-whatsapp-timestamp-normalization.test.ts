import { describe, expect, test } from "vitest";
import { normalizeProviderTimestampToIso } from "../../src/server/integrations/whatsapp/timestamp-normalization";

describe("WhatsApp provider timestamp normalization", () => {
  test("converts Unix seconds to ISO", () => {
    expect(normalizeProviderTimestampToIso("1791110400")).toBe("2026-10-04T10:40:00.000Z");
  });

  test("converts Unix milliseconds to ISO", () => {
    expect(normalizeProviderTimestampToIso("1791110400000")).toBe("2026-10-04T10:40:00.000Z");
  });

  test("normalizes valid ISO input", () => {
    expect(normalizeProviderTimestampToIso("2026-10-04T10:40:00Z")).toBe("2026-10-04T10:40:00.000Z");
  });

  test("fails closed on malformed timestamp input", () => {
    expect(() => normalizeProviderTimestampToIso("not-a-timestamp")).toThrow("PROVIDER_TIMESTAMP_INVALID");
    expect(() => normalizeProviderTimestampToIso("1791110400000000")).toThrow("PROVIDER_TIMESTAMP_INVALID");
    expect(() => normalizeProviderTimestampToIso("")).toThrow("PROVIDER_TIMESTAMP_INVALID");
  });
});
