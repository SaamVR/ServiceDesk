import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const file = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Studio OS operational workspaces", () => {
  it("exposes six real operational workflow destinations without server authority changes", () => {
    const route = file("src/features/operations/OperationalProductRoute.tsx");
    for (const module of ["inbox","requests","quotes","schedule","jobs","invoices"]) {
      expect(route).toContain('module: "' + module + '"');
    }
    expect(route).toContain('aria-label="Service workflow shortcuts"');
    expect(route).toContain('aria-current={module === item.module ? "page" : undefined}');
    expect(route).toContain("loadOperationalStaffSnapshot(workspaceSlug)");
    expect(route).toContain("renderModule(module, result.value");
    expect(route).toContain("assignOperationalCrew");
    expect(route).toContain("enqueueInboxReply");
  });
  it("uses a coherent product workbench with accessible responsive panes", () => {
    const css = file("src/features/operations/OperationalProductRoute.module.css");
    expect(css).toContain(".workflowRail");
    expect(css).toContain(".inboxWorkspace");
    expect(css).toContain(".salesQueueSelected");
    expect(css).toContain(".jobsQueueSelected");
    expect(css).toContain(".scheduleQueueNav");
    expect(css).toContain("background: #e1f3ee");
    expect(css).toContain("max-width: 800px");
    expect(css).toContain("min-width: 1390px");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).toContain(":focus-visible");
  });
});
