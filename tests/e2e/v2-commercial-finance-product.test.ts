import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 commercial finance product workspace", () => {
  it("integrates commercial billing into the professional invoices route without replacing customer collections", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");
    expect(route).toContain('import { CommercialBillingWorkspace }');
    expect(route).toContain('module === "invoices" ? <CommercialBillingWorkspace');
    expect(route).toContain("const customerInvoices = data.invoices.filter((invoice) => Boolean(invoice.quoteId))");
    expect(route).toContain("Commercial contract invoices are managed above");
  });

  it("loads real commercial portfolio and billing records behind authenticated staff resolution", () => {
    const runtime = source("src/features/commercial/commercial-finance-runtime.ts");
    expect(runtime).toContain("resolveStaffActor(workspaceSlug)");
    expect(runtime).toContain("createPostgresCommercialPortfolioReader");
    expect(runtime).toContain('.from("commercial_billing_drafts")');
    expect(runtime).toContain('.from("commercial_billing_lines")');
    expect(runtime).toContain('commercial_billing_draft_id');
    expect(runtime).not.toContain("fixture");
  });

  it("wires draft, line correction, issue and manual collection actions to authoritative commands", () => {
    const workspace = source("src/features/commercial/CommercialBillingWorkspace.tsx");
    const runtime = source("src/features/commercial/commercial-finance-runtime.ts");
    expect(workspace).toContain("Build invoice draft");
    expect(workspace).toContain("Issue invoice");
    expect(workspace).toContain("Exclude");
    expect(workspace).toContain("Include");
    expect(workspace).toContain("Record payment");
    expect(runtime).toContain("createPostgresCommercialBillingCommands");
    expect(runtime).toContain(".createCommercialBillingDraft(");
    expect(runtime).toContain(".setCommercialBillingLineState(");
    expect(runtime).toContain(".finalizeCommercialBillingDraft(");
    expect(workspace).toContain("applyOperationalManualPayment");
  });

  it("keeps payment truth explicit and does not present saved-method charging as available", () => {
    const workspace = source("src/features/commercial/CommercialBillingWorkspace.tsx");
    expect(workspace).toContain("Draft creation never charges a payment method or marks an invoice paid.");
    expect(workspace).toContain("It does not record payment");\n    expect(workspace).toContain("remains outstanding until payment is recorded");
    expect(workspace).toContain("money already received outside the online checkout flow");
    expect(workspace).not.toContain("Charge card");
    expect(workspace).not.toContain("saved payment method");
    expect(workspace).not.toContain("demo");
    expect(workspace).not.toContain("preview");
  });

  it("provides responsive, information-dense commercial finance styling", () => {
    const css = source("src/features/commercial/CommercialBillingWorkspace.module.css");
    expect(css).toContain(".headerMetrics");
    expect(css).toContain(".draftList");
    expect(css).toContain(".line");
    expect(css).toContain(".paymentForm");
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain("@media (max-width: 430px)");
  });
});
