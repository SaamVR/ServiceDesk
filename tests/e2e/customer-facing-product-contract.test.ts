import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const shell = source("src/components/product/CustomerFacingShell.tsx");
const shellCss = source("src/components/product/CustomerFacingShell.module.css");
const portal = source("src/features/operations/CustomerProductRoute.tsx");
const portalCss = source("src/features/operations/CustomerProductRoute.module.css");
const customerRuntime = source("src/features/operations/customer-product-runtime.ts");
const business = source("src/features/operations/BusinessProductRoute.tsx");
const businessCss = source("src/features/operations/BusinessProductRoute.module.css");

describe("customer-facing production product contracts", () => {
  it("uses a dedicated customer account shell instead of legacy marketing chrome", () => {
    expect(portal).toContain("CustomerPortalShell");
    expect(portal).not.toContain('className="site-shell"');
    expect(portal).not.toContain('className="site-header"');
    expect(shell).toContain('aria-label="Customer account"');
    expect(shell).toContain("Customer account mobile navigation");
    expect(shell).toContain('aria-current={activeSection === item.id ? "page" : undefined}');
  });

  it("keeps customer statuses, notices and account content accessible", () => {
    expect(shell).toContain('role={assertive ? "alert" : "status"}');
    expect(shell).toContain('aria-live={assertive ? "assertive" : "polite"}');
    expect(portal).toContain("<CustomerStatus");
    expect(portal).toContain("<CustomerSummaryList>");
    expect(portal).toContain("<DataTable");
  });

  it("removes engineering vocabulary from customer-visible route copy", () => {
    const visibleRouteSource = (portal + business).toLowerCase();
    expect(visibleRouteSource).not.toContain("sandbox checkout");
    expect(visibleRouteSource).not.toContain("provider proof");
    expect(visibleRouteSource).not.toContain("authoritative dto");
    expect(visibleRouteSource).not.toContain("server snapshot");
    expect(visibleRouteSource).not.toContain("command boundary");
    expect(visibleRouteSource).not.toContain("runtime seam");
  });

  it("lets an accepted customer quote select and hold authoritative availability", () => {
    expect(portal).toContain("holdCustomerPortalSlot");
    expect(portal).toContain("Choose a service time");
    expect(portal).toContain("Hold this time");
    expect(portal).toContain("data.workspace.timezone");
    expect(customerRuntime).toContain("createCustomerBookingFactory");
    expect(customerRuntime).toContain("bookingFacade.findSlots");
    expect(customerRuntime).toContain("booking.holdSlot");
    expect(customerRuntime).toContain("customer-slot-hold:");
    expect(customerRuntime).toContain('.from("slot_holds")');
  });

  it("lets customers change current communication preferences through the trusted command", () => {
    expect(portal).toContain("updateCustomerCommunicationPreference");
    expect(portal).toContain("changePreference");
    expect(portal).toContain('\"Allow\"');
    expect(portal).toContain('\"Revoke\"');
    expect(customerRuntime).toContain("servicedesk_record_customer_consent");
    expect(customerRuntime).toContain("expectedConsentId");
    expect(customerRuntime).not.toContain('.from("communication_consents").update');
  });

  it("keeps public business pages focused on services and customer next steps", () => {
    expect(business).toContain("PublicBusinessShell");
    expect(business).toContain("Available services");
    expect(business).toContain("Start an enquiry");
    expect(business).toContain("Open customer account");
    expect(business).not.toContain('className="section-card"');
    expect(business).not.toContain('className="plain-card"');
  });

  it("keeps customer and public surfaces responsive at tablet and phone widths", () => {
    expect(shellCss).toContain("@media (max-width: 900px)");
    expect(shellCss).toContain("@media (max-width: 620px)");
    expect(shellCss).toContain("@media (max-width: 390px)");
    expect(shellCss).toContain("overflow-x: clip");
    expect(portalCss).toContain("@media (max-width: 390px)");
    expect(businessCss).toContain("@media (max-width: 620px)");
    expect(portalCss).toContain("min-height: 44px");
    expect(businessCss).toContain("min-height: 44px");
  });

  it("keeps keyboard focus visible on customer-facing navigation and actions", () => {
    expect(shellCss).toContain(".brand:focus-visible");
    expect(shellCss).toContain(".customerRow:focus-visible");
    expect(portalCss).toContain(".primaryButton:focus-visible");
    expect(businessCss).toContain(".primaryButton:focus-visible");
  });
});
