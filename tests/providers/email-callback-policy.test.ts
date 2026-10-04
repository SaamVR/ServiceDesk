import { describe, expect, test } from "vitest";
import { classifyEmailCallbackPolicy, mapEmailProviderSendFailure } from "../../src/server/integrations/email/callback-policy";

describe("email callback policy", () => {
  test("suppresses hard bounces and complaints, but not temporary soft bounces", () => {
    expect(classifyEmailCallbackPolicy({ eventType: "BOUNCE", bounceType: "hard" })).toMatchObject({ suppressionAction: "SUPPRESS_RECIPIENT", retryable: false, reason: "HARD_BOUNCE" });
    expect(classifyEmailCallbackPolicy({ eventType: "COMPLAINT" })).toMatchObject({ suppressionAction: "SUPPRESS_RECIPIENT", retryable: false, reason: "COMPLAINT" });
    expect(classifyEmailCallbackPolicy({ eventType: "BOUNCE", bounceType: "soft" })).toMatchObject({ suppressionAction: "NONE", retryable: true, reason: "TEMPORARY_BOUNCE" });
  });

  test("keeps delivered callback as acknowledgement only", () => {
    expect(classifyEmailCallbackPolicy({ eventType: "DELIVERED" })).toEqual({ suppressionAction: "NONE", retryable: false, reason: "DELIVERED" });
  });

  test("maps provider send failures for retry and configuration gates", () => {
    expect(mapEmailProviderSendFailure("EMAIL_RATE_LIMITED", 1, 4, "2026-10-04T12:00:00.000Z")).toMatchObject({ action: "RETRY", retryable: true, terminal: false });
    expect(mapEmailProviderSendFailure("EMAIL_TRANSIENT_FAILURE", 4, 4, "2026-10-04T12:00:00.000Z")).toMatchObject({ action: "OPERATOR_REVIEW", retryable: false, terminal: true });
    expect(mapEmailProviderSendFailure("EMAIL_CONFIGURATION_BLOCKED", 0, 4, "2026-10-04T12:00:00.000Z")).toMatchObject({ action: "BLOCKED_CONFIGURATION", retryable: false, terminal: true });
    expect(mapEmailProviderSendFailure("EMAIL_RECIPIENT_REJECTED", 0, 4, "2026-10-04T12:00:00.000Z")).toMatchObject({ action: "DEAD_LETTER", retryable: false, terminal: true });
  });
});
