import { describe, expect, it } from "vitest";
import { buildCrewExecutionView } from "../../src/features/crew/view-models";
import { sampleInvoice, sampleRequest, sampleVisit } from "../../src/features/operations/sample-data";

describe("crew execution view model", () => {
  it("keeps crew actions ordered and requires review before completion", () => {
    const view = buildCrewExecutionView({
      request: sampleRequest,
      visit: { ...sampleVisit, status: "IN_PROGRESS" },
      invoice: sampleInvoice,
    });

    expect(view.currentStatus).toBe("IN_PROGRESS");
    expect(view.primaryAction).toBe("Submit completion review");
    expect(view.reviewRequired).toBe(true);
    expect(view.timeline.map((step) => step.status)).toEqual([
      "ASSIGNED",
      "EN_ROUTE",
      "IN_PROGRESS",
      "PENDING_REVIEW",
      "COMPLETED",
    ]);
    expect(view.checklist.every((item) => item.source === "FIXTURE_UI_ONLY")).toBe(true);
  });

  it("separates evidence, time notes and incident state from visit business status", () => {
    const view = buildCrewExecutionView({
      request: sampleRequest,
      visit: { ...sampleVisit, status: "PENDING_REVIEW" },
      invoice: sampleInvoice,
    });

    expect(view.primaryAction).toBe("Await dispatcher review");
    expect(view.evidenceSlots.map((slot) => slot.kind)).toEqual(["before_photo", "after_photo", "issue_photo"]);
    expect(view.timeNote.label).toContain("materials");
    expect(view.incident.status).toBe("No incident reported");
    expect(view.balanceLabel).toBe("Balance remaining $255.00");
  });

  it("does not expose balance collection as a crew action", () => {
    const view = buildCrewExecutionView({
      request: sampleRequest,
      visit: { ...sampleVisit, status: "COMPLETED" },
      invoice: { ...sampleInvoice, status: "PAID", balanceMinor: 0, allocatedMinor: sampleInvoice.totalMinor },
    });

    expect(view.primaryAction).toBe("Job completed");
    expect(view.balanceLabel).toBe("Balance remaining $0.00");
    expect(view.allowedCrewActions).not.toContain("Collect balance");
    expect(view.businessBoundary).toContain("Crew UI records field evidence only");
  });
});
