import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { showcaseIds } from "../../src/features/operations/sample-data";

describe("Chat 3 product RC handoff", () => {
  it("references canonical showcase IDs and keeps provider proof blocked", () => {
    const handoff = readFileSync(
      join(process.cwd(), "docs/presentation/chat3-product-rc-handoff-20261004.md"),
      "utf8",
    );

    expect(handoff).toContain(showcaseIds.request);
    expect(handoff).toContain(showcaseIds.quote);
    expect(handoff).toContain(showcaseIds.visit);
    expect(handoff).toContain(showcaseIds.invoice);
    expect(handoff).toContain("No provider state in this branch may be treated as `PROVIDER_VERIFIED`");
  });
});
