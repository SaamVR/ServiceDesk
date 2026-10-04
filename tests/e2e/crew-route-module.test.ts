import { describe, expect, it } from "vitest";
import {
  buildCrewModuleHref,
  crewModuleConfig,
  crewNavigation,
} from "../../src/features/operations/crew-modules";

describe("crew route module map", () => {
  it("keeps crew routes focused on today and job detail modules", () => {
    expect(Object.keys(crewModuleConfig)).toEqual(["today", "job"]);
  });

  it("keeps crew navigation mobile-first and ordered", () => {
    expect(crewNavigation.map((item) => item.module)).toEqual(["today", "job"]);
  });

  it("builds stable crew hrefs", () => {
    expect(buildCrewModuleHref("today")).toBe("/crew/today");
    expect(buildCrewModuleHref("job", "visit_showcase_001")).toBe("/crew/jobs/visit_showcase_001");
  });
});
