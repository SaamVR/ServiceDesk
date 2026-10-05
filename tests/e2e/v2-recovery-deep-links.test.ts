import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"),
  "utf8",
);
const css = readFileSync(
  join(process.cwd(), "src/features/operations/OperationalProductRoute.module.css"),
  "utf8",
);

describe("V2 recovery queue deep links", () => {
  it("maps supported attention resources into existing operational workspaces", () => {
    expect(route).toContain("function attentionResourceHref");
    expect(route).toContain('/inbox?conversation=');
    expect(route).toContain('/customers?customer=');
    expect(route).toContain('/requests?request=');
    expect(route).toContain('/quotes?quote=');
    expect(route).toContain('/jobs?job=');
    expect(route).toContain('/invoices?invoice=');
    expect(route).toContain('/quality?case=');
  });

  it("keeps unknown resource types reference-only instead of inventing mutations", () => {
    expect(route).toContain("Reference only");
    expect(route).toContain("Reference only · no supported product action");
    expect(route).toContain("Recovery remains human-owned");
  });

  it("keeps the same deep-link action in the responsive recovery cards", () => {
    expect(route).toContain('className={styles.recoveryActionRow}');
    expect(route).toContain(">Open related record</a>");
    expect(css).toContain(".recoveryActionRow");
    expect(css).toContain("@media(max-width:760px)");
  });
});
