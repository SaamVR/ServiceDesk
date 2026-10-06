import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0039_v2_commercial_profitability_read.sql"),
  "utf8",
);

describe("V2 commercial profitability read model", () => {
  it("groups contract-backed visit economics by site and service", () => {
    expect(sql).toContain("servicedesk_read_commercial_profitability_snapshot");
    expect(sql).toContain("join public.commercial_site_service_plans sp");
    expect(sql).toContain("join public.commercial_contract_sites cs");
    expect(sql).toContain("join public.commercial_sites site");
    expect(sql).toContain("join public.service_catalog svc");
    expect(sql).toContain("group by");
    expect(sql).toContain("vs.site_id");
    expect(sql).toContain("vs.service_id");
  });

  it("uses explicit fixed-per-visit contract rates and surfaces unresolved rates", () => {
    expect(sql).toContain("FIXED_PER_VISIT");
    expect(sql).toContain("contract_value_minor");
    expect(sql).toContain("unresolved_rate_count");
    expect(sql).not.toContain("coalesce(vs.contract_value_minor, 0)");
  });

  it("keeps estimated and actual direct-cost bases separate", () => {
    expect(sql).toContain("basis = 'ESTIMATED'");
    expect(sql).toContain("basis = 'ACTUAL'");
    expect(sql).toContain("recorded_estimated_cost_minor");
    expect(sql).toContain("recorded_actual_completed_cost_minor");
    expect(sql).toContain("recorded_actual_paid_cost_minor");
    expect(sql).toContain("estimatedCostedVisitCount");
    expect(sql).toContain("actualCostedCompletedVisitCount");
  });

  it("attributes paid revenue only after exact full settlement", () => {
    expect(sql).toContain("b.invoice_status = 'PAID' and b.balance_minor = 0");
    expect(sql).toContain("partial_payment_visit_count");
    expect(sql).toContain("partialPaymentInvoiceCount");
    expect(sql).not.toMatch(/prorat|pro[-_ ]?rat/i);
  });

  it("keeps service-unattributed adjustments outside service margins", () => {
    expect(sql).toContain("source_type = 'ADJUSTMENT'");
    expect(sql).toContain("unattributedAdjustments");
    expect(sql).toContain("finalized_adjustment_net_minor");
    expect(sql).toContain("paid_adjustment_net_minor");
  });

  it("labels outputs as recorded margin rather than certified profitability", () => {
    expect(sql).toContain("recordedQuotedMarginMinor");
    expect(sql).toContain("recordedCompletedMarginMinor");
    expect(sql).toContain("recordedPaidMarginMinor");
    expect(sql).toContain("does not infer missing costs");
    expect(sql).toContain("certify tax/profitability");
  });

  it("remains staff-scoped and service-role invoked", () => {
    expect(sql).toContain("v_actor_role not in ('OWNER','DISPATCHER')");
    expect(sql).toContain("servicedesk_require_staff");
    expect(sql).toContain("COMMERCIAL_FEATURE_DISABLED");
    expect(sql).toContain("revoke all on function public.servicedesk_read_commercial_profitability_snapshot(jsonb) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.servicedesk_read_commercial_profitability_snapshot(jsonb) to service_role");
  });
});
