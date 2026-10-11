import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 invoices operational workspace", () => {
  it("persists selected invoice state and focuses one invoice", () => {
    const page = source("src/app/app/[workspace]/invoices/page.tsx");
    const route = source("src/features/operations/OperationalProductRoute.tsx");

    expect(page).toContain("invoice?: string");
    expect(page).toContain("selectedInvoiceId={query.invoice}");
    expect(route).toContain('visibleInvoices.find((invoice) => invoice.id === selectedInvoiceId)');
    expect(route).toContain('selected ? styles.financeQueueSelected : ""');
    expect(route).toContain('href={invoiceQueueHref(queue, search, invoice.id)}');
  });

  it("applies manual payment only to the selected outstanding invoice", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");

    expect(route).toContain('value={selectedInvoice.id}');
    expect(route).toContain("selectedInvoiceCanRecordPayment");
    expect(route).toContain('invoiceFeedbackPrefix(queue, search, invoiceId)');
    expect(route).not.toContain("outstanding.slice(0, 6).map");
  });
});
