import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Loading from "../../src/app/app/[workspace]/loading";
import WorkspaceError from "../../src/app/app/[workspace]/error";

vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/navigation", () => ({ useParams: () => ({ workspace: "review-space" }) }));

describe("V3 authenticated workroom streaming and recovery", () => {
  it("provides a non-fabricated loading skeleton with reduced-motion support", () => {
    const html = renderToStaticMarkup(createElement(Loading));
    const css = readFileSync(join(process.cwd(), "src/app/app/[workspace]/StaffRouteBoundary.module.css"), "utf8");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading the latest records");
    expect(html).not.toContain("ACME");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(":focus-visible");
  });

  it("renders a retry path without exposing exception details or touching a provider", () => {
    const html = renderToStaticMarkup(createElement(WorkspaceError, {
      error: new Error("sensitive operational token / private customer") as Error,
      reset: () => undefined,
    }));
    expect(html).toContain("This workspace did not load");
    expect(html).toContain("Retry this view");
    expect(html).toContain("/app/review-space/overview");
    expect(html).not.toContain("sensitive operational token");
    expect(html).not.toContain("private customer");
  });
});
