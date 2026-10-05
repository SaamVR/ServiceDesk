import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("V2 crew server-action pending feedback", () => {
  it("uses React form pending state instead of pretending a durable offline queue exists", () => {
    const button = source("src/features/crew/CrewActionButton.tsx");
    const page = source("src/app/crew/jobs/[id]/page.tsx");

    expect(button).toContain('"use client"');
    expect(button).toContain("useFormStatus");
    expect(button).toContain("pendingLabel");
    expect(page).toContain("Saving…");
    expect(page).toContain("Sending…");
  });
});
