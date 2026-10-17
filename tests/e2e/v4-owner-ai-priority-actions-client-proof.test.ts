import { describe, expect, it } from "vitest";
import {
  parseVerifiedOwnerBrief, parseVerifiedOwnerPriorityActions,
} from "../../src/features/operations/owner-operations-brief-proof";

const base = {
  ok: true,
  source: "AUTHORIZED_SAVED_WORKSPACE_COUNTS",
  model: "approved-test-model",
  brief: "Review saved critical attention items.",
};
const allowed = [
  { key: "CRITICAL_ATTENTION", module: "overview", priority: "CRITICAL",
    count: 2, source: "VERIFIED_SAVED_QUEUE_COUNT",
    label: "Untrusted backend label", instruction: "Untrusted backend instruction" },
  { key: "LEDGER_REVIEW", module: "invoices", priority: "HIGH",
    count: 1, source: "VERIFIED_SAVED_QUEUE_COUNT" },
  { key: "QUOTE_VALIDITY", module: "quotes", priority: "HIGH",
    count: 4, source: "VERIFIED_SAVED_QUEUE_COUNT" },
  { key: "UNASSIGNED_VISIT", module: "schedule", priority: "HIGH",
    count: 3, source: "VERIFIED_SAVED_QUEUE_COUNT" },
  { key: "COLLECTIBLE_INVOICE", module: "invoices", priority: "NORMAL",
    count: 5, source: "VERIFIED_SAVED_QUEUE_COUNT" },
];

describe("Owner UI consumes server-ranked verified priority actions without re-ranking", () => {
  it("keeps backward compatible advisory source when old action lacks priorities", () => {
    expect(parseVerifiedOwnerBrief(base)).toEqual({
      source: base.source, model: base.model, brief: base.brief,
    });
  });
  it("accepts up to five exact known source/action/route contracts", () => {
    const result = parseVerifiedOwnerBrief({ ...base, priorityActions: allowed });
    expect(result?.priorityActions).toHaveLength(5);
    expect(result?.priorityActions?.map(item => item.key)).toEqual(
      allowed.map(item => item.key),
    );
    expect(result?.priorityActions?.map(item => item.count)).toEqual([2,1,4,3,5]);
    expect(result?.priorityActions?.map(item => item.module)).toEqual([
      "overview", "invoices", "quotes", "schedule", "invoices",
    ]);
  });
  it("discards arbitrary server label/instruction payloads and private context", () => {
    const raw = [{ ...allowed[0],
      label: "Customer private@example.invalid",
      instruction: "Send a message to private@example.invalid",
      notes: "PRIVATE RAW MESSAGE" }];
    const result = parseVerifiedOwnerPriorityActions(raw);
    expect(result?.[0].title).toBe("Critical attention items");
    expect(JSON.stringify(result)).not.toMatch(/private@example.invalid|PRIVATE RAW MESSAGE/);
  });
  it("fails closed on spoofed routes, wrong source, duplicates and unordered results", () => {
    for (const bad of [
      [{ ...allowed[0], module: "billing" }],
      [{ ...allowed[0], source: "GENERATED_BY_MODEL" }],
      [{ ...allowed[0], priority: "NORMAL" }],
      [{ ...allowed[0], count: 0 }],
      [{ ...allowed[0], count: 1.5 }],
      [{ ...allowed[0], count: 5001 }],
      [{ ...allowed[0], count: "2" }],
      [allowed[0], allowed[0]],
      [allowed[1], allowed[0]],
      [...allowed, { ...allowed[0], count: 3 }],
      { object: "not an array" },
      "untrusted",
      [Object.assign(Object.create({ private: "foo" }), allowed[0])],
    ]) {
      expect(parseVerifiedOwnerPriorityActions(bad)).toBeNull();
      expect(parseVerifiedOwnerBrief({ ...base, priorityActions: bad })).toBeNull();
    }
  });
  it("accepts a verified zero-action array without asserting all work is complete", () => {
    expect(parseVerifiedOwnerPriorityActions([])).toEqual([]);
    expect(parseVerifiedOwnerBrief({ ...base, priorityActions: [] })?.priorityActions)
      .toEqual([]);
  });
});
