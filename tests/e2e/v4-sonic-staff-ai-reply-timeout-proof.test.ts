import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  STAFF_AI_DRAFT_TIMEOUT_MS, STAFF_AI_REQUEST_TIMEOUT_MS,
  boundedStaffRequestSignal,
} from "../../src/features/operations/staff-ai-request-signal";

const source = readFileSync(join(process.cwd(),
  "src/features/operations/StaffAiReviewComposer.tsx"), "utf8");

describe("Sonic staff AI draft versus durable reply approval deadlines", () => {
  it("allows the 60s opt-in Codex model budget with 15s transport overhead", () => {
    expect(STAFF_AI_DRAFT_TIMEOUT_MS).toBe(75_000);
    expect(STAFF_AI_REQUEST_TIMEOUT_MS).toBe(20_000);
    expect(source).toContain("boundedStaffRequestSignal(pending, STAFF_AI_DRAFT_TIMEOUT_MS)");
    expect(source).toContain("requestSignal.addEventListener(\"abort\", onDraftDeadline, { once: true })");
    expect(source).toContain("requestSignal.removeEventListener(\"abort\", onDraftDeadline)");
    expect(source).toContain("requestSignal.addEventListener(\"abort\", onApprovalDeadline, { once: true })");
    expect(source).toContain("requestSignal.removeEventListener(\"abort\", onApprovalDeadline)");
    expect(source).toContain('controller.current = null;');
    expect(source).toContain('setError("approval")');
    expect(source).toContain("without fetch()/response.json() settling");
    expect(source).toContain("const requestSignal = boundedStaffRequestSignal(pending);");
  });
  it("never publishes buffered model or approval results after abort or supersession", () => {
    expect(source).toContain("requestSignal.aborted || controller.current !== pending");
    expect(source).toContain("if (pending.signal.aborted || requestSignal.aborted || controller.current !== pending) return;");
    expect(source).toContain("requestSignal.aborted || pending.signal.aborted || controller.current !== pending");
    expect(source).toContain("controller.current = null;");
    expect(source).toContain("const replyFieldId = useId()");
    expect(source).toContain("htmlFor={replyFieldId}");
    expect(source).toContain("id={replyFieldId}");
    expect(source).toContain("parseReviewedReplyReceipt");
    expect(source).toContain("idempotencyKey.current ??= crypto.randomUUID()");
  });
  it("shows uncertain approval as pending verification, not a failed/customer-delivered send", () => {
    expect(source).toContain("Timed-out approval may already have queued a durable reply");
    expect(source).toContain("Check the saved conversation before trying again");
    expect(source).toContain('error === "approval" && !retryVerified');
    expect(source).toContain('idempotencyKey.current ??= crypto.randomUUID()');
    expect(source).toContain("I inspected the saved Inbox history");
    expect(source).toContain("Queue acceptance is not customer delivery confirmation.");
    expect(source).not.toContain("provider request cancelled successfully");
  });
  it("manually aborts either independent deadline", () => {
    for (const limit of [STAFF_AI_DRAFT_TIMEOUT_MS, STAFF_AI_REQUEST_TIMEOUT_MS]) {
      const controller = new AbortController();
      const signal = boundedStaffRequestSignal(controller, limit);
      controller.abort();
      expect(signal.aborted).toBe(true);
    }
  });
});
