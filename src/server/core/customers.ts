export interface CustomerPropertyImportRow {
  line: number;
  displayName: string;
  email?: string;
  phone?: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  countryCode: string;
}

export interface ImportError {
  line: number;
  code: string;
  message: string;
}

export interface CustomerPropertyImportDryRun {
  validRows: CustomerPropertyImportRow[];
  errors: ImportError[];
}

export type ImportCommitResult =
  | { ok: true; imported: number }
  | { ok: false; code: "IMPORT_DRY_RUN_HAS_ERRORS"; message: string; errors: ImportError[] };

const REQUIRED_HEADERS = ["display_name", "email", "phone", "address_line1", "city", "postal_code", "country_code"] as const;

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }

    cell += char;
  }

  cells.push(cell.trim());
  return cells;
}

function requiredError(line: number, code: string, field: string): ImportError {
  return { line, code, message: `${field} is required` };
}

export function dryRunCustomerPropertyCsv(csv: string): CustomerPropertyImportDryRun {
  const physicalLines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (physicalLines.length === 0) {
    return { validRows: [], errors: [{ line: 1, code: "EMPTY_FILE", message: "CSV file is empty" }] };
  }

  const headers = parseCsvLine(physicalLines[0]);
  const missingHeader = REQUIRED_HEADERS.find((header) => !headers.includes(header));
  if (missingHeader) {
    return { validRows: [], errors: [{ line: 1, code: "MISSING_HEADER", message: `${missingHeader} header is required` }] };
  }

  const validRows: CustomerPropertyImportRow[] = [];
  const errors: ImportError[] = [];

  for (let rowIndex = 1; rowIndex < physicalLines.length; rowIndex += 1) {
    const lineNumber = rowIndex + 1;
    const cells = parseCsvLine(physicalLines[rowIndex]);
    const value = (name: string): string => cells[headers.indexOf(name)]?.trim() ?? "";

    const displayName = value("display_name");
    const addressLine1 = value("address_line1");
    const city = value("city");
    const postalCode = value("postal_code");

    if (!displayName) errors.push(requiredError(lineNumber, "MISSING_DISPLAY_NAME", "display_name"));
    if (!addressLine1) errors.push(requiredError(lineNumber, "MISSING_ADDRESS_LINE1", "address_line1"));
    if (!city) errors.push(requiredError(lineNumber, "MISSING_CITY", "city"));
    if (!postalCode) errors.push(requiredError(lineNumber, "MISSING_POSTAL_CODE", "postal_code"));
    if (!displayName || !addressLine1 || !city || !postalCode) continue;

    validRows.push({
      line: lineNumber,
      displayName,
      email: value("email") || undefined,
      phone: value("phone") || undefined,
      addressLine1,
      city,
      postalCode,
      countryCode: (value("country_code") || "GB").toUpperCase(),
    });
  }

  return { validRows, errors };
}

export function commitCustomerPropertyImport(
  dryRun: CustomerPropertyImportDryRun,
  commitRow: (row: CustomerPropertyImportRow) => void,
): ImportCommitResult {
  if (dryRun.errors.length > 0) {
    return {
      ok: false,
      code: "IMPORT_DRY_RUN_HAS_ERRORS",
      message: "Fix dry-run errors before importing. No rows were committed.",
      errors: dryRun.errors,
    };
  }

  for (const row of dryRun.validRows) commitRow(row);
  return { ok: true, imported: dryRun.validRows.length };
}

function escapeCsv(value: string | undefined): string {
  const safe = value ?? "";
  if (!/[",\n\r]/.test(safe)) return safe;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function exportCustomerPropertiesCsv(rows: readonly CustomerPropertyImportRow[]): string {
  const header = REQUIRED_HEADERS.join(",");
  const body = rows.map((row) => [
    row.displayName,
    row.email,
    row.phone,
    row.addressLine1,
    row.city,
    row.postalCode,
    row.countryCode,
  ].map(escapeCsv).join(","));

  return [header, ...body].join("\n");
}
