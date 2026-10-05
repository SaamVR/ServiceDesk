import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("V2 crew production runtime contract", () => {
  it("authenticates crew and intersects active membership with active crew membership before service-role reads", () => {
    const runtime = source("src/features/crew/crew-product-runtime.ts");
    expect(runtime).toContain('.eq("role", "CREW")');
    expect(runtime).toContain('.from("crew_members")');
    expect(runtime).toContain('.eq("active", true)');
    expect(runtime).toContain("eligibleWorkspaceIds");
    expect(runtime).toContain("assignedToUser");
    expect(runtime).toContain('.in("crew_id", crewIds)');
  });

  it("loads only workspace-scoped related field context and carries workspace timezone", () => {
    const runtime = source("src/features/crew/crew-product-runtime.ts");
    for (const table of [
      "requests",
      "quotes",
      "visit_evidence",
      "visit_checklist_items",
      "attention_items",
      "service_catalog",
      "properties",
      "customers",
    ]) {
      expect(runtime).toContain('.from("' + table + '")');
    }
    expect(runtime).toContain('.eq("workspace_id", workspace.id)');
    expect(runtime).toContain("workspaceTimeZone: workspace.timezone");
    expect(runtime).toContain('scope: "ASSIGNED_CREW_ONLY"');
  });

  it("uses accepted field RPC adapters for crew actions without exposing completion", () => {
    const runtime = source("src/features/crew/crew-product-runtime.ts");
    expect(runtime).toContain("createPostgresVisitFieldRuntimeFacadeMethods");
    expect(runtime).toContain("facade.transitionVisit");
    expect(runtime).toContain("facade.setVisitChecklistItem");
    expect(runtime).toContain("facade.addVisitEvidence");
    expect(runtime).toContain('kind: "INCIDENT_NOTE"');
    expect(runtime).not.toContain('"COMPLETE"');
  });

  it("wires the real crew pages to product runtime rather than fixtures", () => {
    const today = source("src/app/crew/today/page.tsx");
    const job = source("src/app/crew/jobs/[id]/page.tsx");

    expect(today).toContain("loadCrewTodayProduct");
    expect(today).toContain("CrewTodayV2");
    expect(job).toContain("loadCrewJobProduct");
    expect(job).toContain("transitionCrewProductVisit");
    expect(job).toContain("setCrewProductChecklistItem");
    expect(job).toContain("reportCrewProductIssue");

    expect(today).not.toContain("OperationalFixtureRoute");
    expect(job).not.toContain("OperationalFixtureRoute");
  });

  it("keeps photo upload honest while allowing persisted incident notes", () => {
    const runtime = source("src/features/crew/crew-product-runtime.ts");
    const field = source("src/features/crew/v2-field-models.ts");
    expect(runtime).toContain('kind: "INCIDENT_NOTE"');
    expect(field).toContain("Photo upload isn’t available on this screen yet.");
  });
});
