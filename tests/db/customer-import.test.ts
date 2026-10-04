import { describe, expect, it } from "vitest";
import { commitCustomerPropertyImport, dryRunCustomerPropertyCsv, exportCustomerPropertiesCsv } from "../../src/server/core/customers";

describe("customer/property CSV import", () => {
  it("reports malformed rows by exact line and blocks partial commit", () => {
    const dryRun = dryRunCustomerPropertyCsv([
      "display_name,email,phone,address_line1,city,postal_code,country_code",
      "Ada Lovelace,ada@example.test,,1 Algorithm St,London,N1 1AA,GB",
      "Grace Hopper,grace@example.test,,\"\",London,N2 2AA,GB",
    ].join("\n"));

    expect(dryRun.validRows).toHaveLength(1);
    expect(dryRun.errors).toEqual([
      { line: 3, code: "MISSING_ADDRESS_LINE1", message: "address_line1 is required" },
    ]);

    const committed: string[] = [];
    const result = commitCustomerPropertyImport(dryRun, (row) => committed.push(row.displayName));

    expect(result).toEqual({
      ok: false,
      code: "IMPORT_DRY_RUN_HAS_ERRORS",
      message: "Fix dry-run errors before importing. No rows were committed.",
      errors: dryRun.errors,
    });
    expect(committed).toEqual([]);
  });

  it("commits only after a clean dry-run and exports scoped rows", () => {
    const dryRun = dryRunCustomerPropertyCsv([
      "display_name,email,phone,address_line1,city,postal_code,country_code",
      "Ada Lovelace,ada@example.test,,1 Algorithm St,London,N1 1AA,GB",
    ].join("\n"));

    expect(dryRun.errors).toEqual([]);

    const committed: string[] = [];
    expect(commitCustomerPropertyImport(dryRun, (row) => committed.push(row.displayName))).toEqual({ ok: true, imported: 1 });
    expect(committed).toEqual(["Ada Lovelace"]);
    expect(exportCustomerPropertiesCsv(dryRun.validRows)).toBe([
      "display_name,email,phone,address_line1,city,postal_code,country_code",
      "Ada Lovelace,ada@example.test,,1 Algorithm St,London,N1 1AA,GB",
    ].join("\n"));
  });
});
