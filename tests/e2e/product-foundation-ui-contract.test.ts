import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const dataTable = source("src/components/product/DataTable.tsx");
const workspace = source("src/components/product/WorkspacePrimitives.tsx");
const forms = source("src/components/product/FormPrimitives.tsx");
const dialog = source("src/components/product/AppDialog.tsx");
const shell = source("src/components/product/StaffAppShell.tsx");
const css = source("src/app/globals.css");
const a11yCss = source("src/app/responsive-a11y.css");

describe("professional product foundation contracts", () => {
  it("keeps the shared data table semantic and state-addressable", () => {
    expect(dataTable).toContain("<table>");
    expect(dataTable).toContain("<caption");
    expect(dataTable).toContain('scope="col"');
    expect(dataTable).toContain("aria-sort");
    expect(dataTable).toContain("aria-selected");
    expect(dataTable).toContain("app-data-scroll");
    expect(dataTable).toContain("app-data-mobile");
  });

  it("supports list/detail drill-in and business toolbar controls", () => {
    expect(workspace).toContain("app-split-workspace");
    expect(workspace).toContain("data-mobile-focus");
    expect(workspace).toContain('role="list"');
    expect(workspace).toContain('type="search"');
    expect(workspace).toContain("app-segmented-tabs");
    expect(workspace).toContain("app-sort-control");
  });

  it("associates form help and validation with native controls", () => {
    expect(forms).toContain("<fieldset");
    expect(forms).toContain("<legend>");
    expect(forms).toContain("aria-describedby");
    expect(forms).toContain("aria-invalid");
    expect(forms).toContain('role="alert"');
    expect(forms).toContain('type="checkbox"');
  });

  it("uses the native modal boundary for focus, escape and backdrop behavior", () => {
    expect(dialog).toContain("showModal()");
    expect(dialog).toContain("onCancel");
    expect(dialog).toContain("aria-labelledby");
    expect(dialog).toContain("app-dialog-drawer");
    expect(css).toContain(".app-dialog::backdrop");
  });

  it("keeps app chrome and primitives responsive without horizontal page spill", () => {
    expect(css).toContain(".app-shell { max-width: 100vw; overflow-x: clip; }");
    expect(css).toContain("@media (max-width: 900px)");
    expect(css).toContain("@media (max-width: 700px)");
    expect(css).toContain("@media (max-width: 430px)");
    expect(css).toContain("overflow-x: auto");
    expect(a11yCss).toContain("min-height: 44px");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps authenticated shell copy free of fixture and evidence language", () => {
    expect(shell.toLowerCase()).not.toContain("fixture");
    expect(shell.toLowerCase()).not.toContain("evidence");
    expect(shell.toLowerCase()).not.toContain("preview");
  });
});
