import { describe, expect, it } from "vitest";
import {
  canCrewEditChecklist,
  canCrewReportIssue,
  requiredCrewFieldMutationHardening,
} from "../../src/features/crew/field-action-policy";

describe("V2 crew field action policy", () => {
  it("allows checklist edits only during active field execution", () => {
    expect(canCrewEditChecklist("ASSIGNED")).toBe(true);
    expect(canCrewEditChecklist("EN_ROUTE")).toBe(true);
    expect(canCrewEditChecklist("IN_PROGRESS")).toBe(true);
    expect(canCrewEditChecklist("PENDING_REVIEW")).toBe(false);
    expect(canCrewEditChecklist("COMPLETED")).toBe(false);
    expect(canCrewEditChecklist("CANCELLED")).toBe(false);
  });

  it("allows issue reporting through review handoff but not after terminal states", () => {
    expect(canCrewReportIssue("ASSIGNED")).toBe(true);
    expect(canCrewReportIssue("IN_PROGRESS")).toBe(true);
    expect(canCrewReportIssue("PENDING_REVIEW")).toBe(true);
    expect(canCrewReportIssue("COMPLETED")).toBe(false);
    expect(canCrewReportIssue("CANCELLED")).toBe(false);
  });

  it("records the remaining atomic Core version requirement honestly", () => {
    expect(requiredCrewFieldMutationHardening.checklist.coreRequirement).toContain("expectedVersion");
    expect(requiredCrewFieldMutationHardening.incident.coreRequirement).toContain("expectedVersion");
  });
});
