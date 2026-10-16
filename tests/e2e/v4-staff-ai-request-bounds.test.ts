import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  boundedStaffRequestSignal,
  STAFF_AI_REQUEST_TIMEOUT_MS,
} from "../../src/features/operations/staff-ai-request-signal";

describe("staff AI network request deadline and cancellation", () => {
  test("uses a bounded default deadline for suggestions and idempotent approval", () => {
    expect(STAFF_AI_REQUEST_TIMEOUT_MS).toBe(20_000);
    const ui = readFileSync(join(process.cwd(),
      "src/features/operations/StaffAiReviewComposer.tsx"), "utf8");
    expect(ui.split("boundedStaffRequestSignal(pending)").length - 1).toBe(2);
    expect(ui.match(/signal: requestSignal/g)).toHaveLength(2);
    expect(ui).toContain("idempotencyKey.current ??= crypto.randomUUID()");
    expect(ui).toContain("Check the saved conversation before trying again");
  });

  test("manual cancellation immediately aborts request without waiting for deadline", () => {
    const controller = new AbortController();
    const signal = boundedStaffRequestSignal(controller, 1_000);
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
  });

  test("slow request aborts at deadline without aborting the manual controller", async () => {
    const controller = new AbortController();
    const signal = boundedStaffRequestSignal(controller, 5);
    await new Promise<void>(resolve => {
      if (signal.aborted) return resolve();
      signal.addEventListener("abort", () => resolve(), { once: true });
      // Keep event loop alive in Node to permit AbortSignal.timeout dispatch.
      setTimeout(resolve, 150);
    });
    expect(signal.aborted).toBe(true);
    expect(controller.signal.aborted).toBe(false);
  });
});
