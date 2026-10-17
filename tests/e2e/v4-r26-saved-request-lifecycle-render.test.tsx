import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SavedRequestLifecycleEvidence } from "../../src/features/operations/SavedRequestLifecycleEvidence";
import type { OperationalRequest, OperationalQuote, OperationalInvoice, OperationalVisit } from "../../src/features/operations/operational-product-runtime";

const req = {id:"request-one",status:"READY",version:2,serviceLabel:"Deep cleaning"} as OperationalRequest;
const offer = {id:"quote-one",requestId:"request-one",version:1,status:"ACCEPTED"} as OperationalQuote;
const visit = {id:"visit-one",requestId:"request-one",quoteId:"quote-one",status:"IN_PROGRESS"} as OperationalVisit;
const invoice = {id:"invoice-one",quoteId:"quote-one",status:"OPEN"} as OperationalInvoice;

function html(data: { quotes: OperationalQuote[];visits:OperationalVisit[];invoices:OperationalInvoice[] }) {
  return renderToStaticMarkup(<SavedRequestLifecycleEvidence
    request={req} data={data} workspaceSlug="test-cleaning" />);
}

describe("R26 critic: actual rendered operator lifecycle proof", () => {
  it("renders four grounded stages with direct links only for exactly associated saved records", () => {
    const rendered=html({quotes:[offer],visits:[visit],invoices:[invoice]});
    expect(rendered).toContain("Customer journey and next handoffs");
    expect(rendered).toContain("Persisted evidence");
    expect(rendered).toContain("/app/test-cleaning/requests?request=request-one");
    expect(rendered).toContain("/app/test-cleaning/quotes?quote=quote-one");
    expect(rendered).toContain("/app/test-cleaning/jobs?job=visit-one");
    expect(rendered).toContain("/app/test-cleaning/invoices?invoice=invoice-one");
    expect(rendered).toContain("not proof that no record exists");
  });
  it("keeps generic routes and absent labels when no quote or job is observed", () => {
    const rendered=html({quotes:[],visits:[],invoices:[]});
    expect(rendered).toContain("/app/test-cleaning/quotes");
    expect(rendered).toContain("/app/test-cleaning/jobs");
    expect(rendered).not.toContain("?quote=");
    expect(rendered).not.toContain("?job=");
    expect(rendered).not.toContain("?invoice=");
    expect(rendered).toContain("NOT OBSERVED");
  });
  it("does not link arbitrarily through two same-version customer quotes", () => {
    const rendered=html({quotes:[offer,{...offer,id:"quote-two"}],visits:[visit],invoices:[invoice]});
    expect(rendered).toContain("Multiple current offers share the highest version");
    expect(rendered).not.toContain("?quote=");
    expect(rendered).not.toContain("?job=");
    expect(rendered).not.toContain("?invoice=");
  });
});
