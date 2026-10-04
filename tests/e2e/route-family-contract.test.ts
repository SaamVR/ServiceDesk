import { describe, expect, it } from "vitest";
import { routeFamilies } from "../../src/features/product/story-model";

describe("route family registry", () => {
  it("covers every business, customer, staff and crew route family used by the product lane", () => {
    expect(routeFamilies.business).toEqual(["/b/[slug]", "/b/[slug]/enquire", "/b/[slug]/book"]);
    expect(routeFamilies.customer).toEqual([
      "/portal",
      "/portal/properties",
      "/portal/quotes/[id]",
      "/portal/bookings/[id]",
      "/portal/invoices/[id]",
      "/portal/preferences",
    ]);
    expect(routeFamilies.crew).toEqual(["/crew/today", "/crew/jobs/[id]"]);
    expect(routeFamilies.staff).toEqual([
      "/app/[workspace]/overview",
      "/app/[workspace]/inbox",
      "/app/[workspace]/customers",
      "/app/[workspace]/requests",
      "/app/[workspace]/quotes",
      "/app/[workspace]/schedule",
      "/app/[workspace]/jobs",
      "/app/[workspace]/invoices",
      "/app/[workspace]/quality",
      "/app/[workspace]/automations",
      "/app/[workspace]/reports",
      "/app/[workspace]/settings",
      "/app/[workspace]/billing",
    ]);
  });
});
