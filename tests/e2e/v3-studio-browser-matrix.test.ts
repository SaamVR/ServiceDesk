import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";

const capture = () => readFileSync(join(process.cwd(), "tests/e2e/v3-capture-workroom.mjs"), "utf8");

describe("V3 Studio OS browser acceptance capture matrix", () => {
  it("parses as executable ES module source", () => {
    const result = ts.transpileModule(capture(), {
      fileName: "v3-capture-workroom.mjs",
      reportDiagnostics: true,
      compilerOptions: { allowJs: true, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    expect(result.diagnostics?.filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error) ?? []).toEqual([]);
  });

  it("passes native Node syntax parsing without running any browser or network", () => {
    const result = spawnSync(process.execPath, [
      "--check", join(process.cwd(), "tests/e2e/v3-capture-workroom.mjs"),
    ], { encoding: "utf8", timeout: 5_000 });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("requires the host-reported integration SHA and scenario-specific real workbench before any capture", () => {
    const source = capture();
    expect(source).toContain("async function assertHostReportedSourceSha()");
    expect(source).toContain('method: "GET"');
    expect(source).toContain('credentials: "omit"');
    expect(source).toContain('redirect: "manual"');
    expect(source).toContain("const hostSourceProvider = await assertHostReportedSourceSha()");
    expect(source).toContain("Preview-reported source SHA does not match");
    expect(source).toContain("hostReportedSourceShaMatches: true");
    expect(source).toContain("independentlyVerifiedSourceSha: false");
    expect(source).toContain("page.regionReady");
    for (const label of [
      "Workday briefing",
      "Customer conversations",
      "Scheduling and dispatch workspace",
      "Field jobs workspace",
      "Quality review workspace",
      "Invoice collection workspace",
      "Commercial billing summary",
      "Workspace settings console",
    ]) {
      expect(source).toContain(label);
    }
  });

  it("captures all eight requested staff workspaces at five fixed mobile-to-desktop widths", () => {
    const source = capture();
    for (const row of [
      '{ name: "today", module: "overview" }',
      '{ name: "inbox", module: "inbox" }',
      '{ name: "schedule", module: "schedule" }',
      '{ name: "jobs", module: "jobs" }',
      '{ name: "quality", module: "quality" }',
      '{ name: "customer-collections", module: "invoices", surface: "customers" }',
      '{ name: "commercial-accounts", module: "invoices", surface: "commercial" }',
      '{ name: "settings", module: "settings" }',
    ]) {
      expect(source).toContain(row);
    }
    expect(source).toContain("const widths = [320, 390, 834, 1280, 1440]");
    expect(source).toContain("const name = scenario.name + \"-\" + width + \".png\"");
    expect(source).toContain("await authenticatedPage(cdp, path, scenario)");
    expect(source).toContain('if (scenario.surface) target.searchParams.set("surface", scenario.surface)');
    expect(source).not.toContain("for (const module of modules)");
  });

  it("retains fail-closed authentication, finance, screenshot and evidence controls", () => {
    const source = capture();
    expect(source).toContain('if (input("V3_QA_ISOLATED") !== "1")');
    expect(source).toContain("Staff session is not authenticated");
    expect(source).toContain("commercialBlocked");
    expect(source).toContain("Commercial finance is not enabled/available");
    expect(source).toContain("selectedSurface");
    expect(source).toContain("Horizontal overflow at");
    expect(source).toContain("validatePNG(png, width, height)");
    expect(source).toContain("independentlyVerifiedSourceSha: false");
    expect(source).toContain("CAPTURED_NOT_YET_VISUALLY_ACCEPTED");
    expect(source).toContain("randomUUID()");
    expect(source).toContain("authenticated browser profiles must stay outside Git");
    expect(source).toContain("DevToolsActivePort");
    expect(source).toContain("mode: 0o700");
    expect(source).toContain("QA screenshot directory must be private and empty");
  });
});
