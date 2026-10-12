import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  summarizeOwnerOperationalEvidence,
} from "../../src/features/onboarding/owner-operational-evidence";

type Snapshot = Parameters<typeof summarizeOwnerOperationalEvidence>[0];
const request = (id: string) => ({ id, status: "NEW" });
const quote = (id: string, requestId: string, status: string,
  currency = "USD", totalMinor = 12500) =>
  ({ id, requestId, status, currency, totalMinor });

const values = (part: Partial<Snapshot> = {}): Snapshot => ({
  requests: [],
  quotes: [],
  visits: [],
  invoices: [],
  workflowAvailable: false,
  ...part,
} as Snapshot);

describe("V4 owner live operational evidence, never synthetic proof", () => {
  it("shows missing data accurately, not as a complete journey", () => {
    expect(summarizeOwnerOperationalEvidence(values())).toEqual({
      savedRequests: 0, sentQuotes: 0, acceptedQuotes: 0,
      recordedVisits: 0, savedInvoices: 0, completedInternalAttention: null,
    });
  });

  it("counts only linked, priced and valid-currency sent/accepted quotes", () => {
    const result = summarizeOwnerOperationalEvidence(values({
      requests: [request("req-a"), request("req-a"), request("req-b")],
      quotes: [
        quote("q1", "req-a", "SENT"),
        quote("q2", "req-a", "ACCEPTED"),
        quote("q3", "unknown-request", "ACCEPTED"),
        quote("q4", "req-a", "DRAFT"),
        quote("q5", "req-b", "ACCEPTED", "usd"),
        quote("q6", "req-b", "SENT", "USD", -1),
      ],
    } as unknown as Partial<Snapshot>));
    expect(result).toMatchObject({ savedRequests: 2, sentQuotes: 2, acceptedQuotes: 1 });
  });

  it("does not count visits/invoices without an accepted quote and linked saved request", () => {
    const result = summarizeOwnerOperationalEvidence(values({
      requests: [request("a")],
      quotes: [quote("sent", "a", "SENT"), quote("accepted", "a", "ACCEPTED")],
      visits: [
        { id: "v1", quoteId: "accepted", requestId: "a" },
        { id: "v2", quoteId: "sent", requestId: "a" },
        { id: "v3", quoteId: "accepted", requestId: "other" },
      ],
      invoices: [
        { id: "i1", quoteId: "accepted" }, { id: "i2", quoteId: "sent" },
        { id: "i3" },
      ],
    } as unknown as Partial<Snapshot>));
    expect(result).toMatchObject({ recordedVisits: 1, savedInvoices: 1 });
  });

  it("excludes previews, drafts, unmatched and external send actions", () => {
    const result = summarizeOwnerOperationalEvidence(values({
      workflowAvailable: true,
      workflowExecutions: [
        { id: "preview", mode: "PREVIEW", eventType: "QUOTE_ACCEPTED", matched: true,
          state: "COMPLETED", branchId: "north" },
        { id: "live", mode: "LIVE", eventType: "QUOTE_ACCEPTED", matched: true,
          state: "COMPLETED", branchId: "north" },
        { id: "failed", mode: "LIVE", eventType: "QUOTE_ACCEPTED", matched: true,
          state: "PARTIAL_FAILED", branchId: "north" },
        { id: "wrong-event", mode: "LIVE", eventType: "REQUEST_CREATED", matched: true,
          state: "COMPLETED", branchId: "north" },
        { id: "unmatched", mode: "LIVE", eventType: "QUOTE_ACCEPTED", matched: false,
          state: "COMPLETED", branchId: "north" },
      ],
      workflowActionExecutions: [
        { executionId: "preview", branchId: "north", actionType: "CREATE_ATTENTION", state: "SUCCEEDED" },
        { executionId: "live", branchId: "south", actionType: "CREATE_ATTENTION", state: "SUCCEEDED" },
        { executionId: "live", branchId: "north", actionType: "SEND_WHATSAPP_TEMPLATE", state: "SUCCEEDED" },
        { executionId: "live", branchId: "north", actionType: "CREATE_ATTENTION", state: "APPROVAL_REQUIRED" },
        { executionId: "failed", branchId: "north", actionType: "CREATE_ATTENTION", state: "SUCCEEDED" },
        { executionId: "wrong-event", branchId: "north", actionType: "CREATE_ATTENTION", state: "SUCCEEDED" },
        { executionId: "unmatched", branchId: "north", actionType: "CREATE_ATTENTION", state: "SUCCEEDED" },
      ],
    } as unknown as Partial<Snapshot>));
    expect(result.completedInternalAttention).toBe(0);
  });

  it("counts one verified live attention execution only once despite retries", () => {
    const result = summarizeOwnerOperationalEvidence(values({
      workflowAvailable: true,
      workflowExecutions: [
        { id: "live", mode: "LIVE", eventType: "QUOTE_ACCEPTED", matched: true,
          state: "COMPLETED", branchId: "north" },
      ],
      workflowActionExecutions: [
        { executionId: "live", branchId: "north", actionType: "CREATE_ATTENTION", state: "SUCCEEDED" },
        { executionId: "live", branchId: "north", actionType: "CREATE_ATTENTION", state: "SUCCEEDED" },
      ],
    } as unknown as Partial<Snapshot>));
    expect(result.completedInternalAttention).toBe(1);
  });

  it("distinguishes unavailable workflow proof from an available empty ledger", () => {
    expect(summarizeOwnerOperationalEvidence(values({
      workflowAvailable: true, workflowExecutions: [], workflowActionExecutions: [],
    })).completedInternalAttention).toBe(0);
    expect(summarizeOwnerOperationalEvidence(values({
      workflowAvailable: false, workflowExecutions: [], workflowActionExecutions: [],
    })).completedInternalAttention).toBeNull();
    expect(summarizeOwnerOperationalEvidence(values({
      workflowAvailable: true, workflowExecutions: undefined, workflowActionExecutions: [],
    })).completedInternalAttention).toBeNull();
  });

  it("does not include foreign branch records when owner explicitly selected one branch", () => {
    const onlyNorth = {
      mode: "BRANCH", selectedBranchId: "north",
      branches: [{ id: "north", code: "US-N", name: "North",
        timezone: "America/New_York", currency: "USD" }],
    };
    const results = summarizeOwnerOperationalEvidence(values({
      branchScope: onlyNorth,
      requests: [
        { id: "north-req", branchId: "north" },
        { id: "south-req", branchId: "south" },
      ],
      quotes: [
        quote("north-quote", "north-req", "ACCEPTED"),
        quote("south-quote", "south-req", "ACCEPTED"),
      ],
      visits: [
        { id: "good", requestId: "north-req", quoteId: "north-quote", branchId: "north" },
        { id: "foreign", requestId: "south-req", quoteId: "south-quote", branchId: "south" },
        { id: "mismatch", requestId: "north-req", quoteId: "north-quote", branchId: "south" },
      ],
      invoices: [
        { id: "i1", quoteId: "north-quote", visitId: "good" },
        { id: "i2", quoteId: "north-quote", visitId: "mismatch" },
        { id: "i3", quoteId: "south-quote", visitId: "foreign" },
      ],
      workflowAvailable: true,
      workflowExecutions: [
        { id: "north-execution", mode: "LIVE", eventType: "QUOTE_ACCEPTED",
          matched: true, state: "COMPLETED", branchId: "north" },
        { id: "south-execution", mode: "LIVE", eventType: "QUOTE_ACCEPTED",
          matched: true, state: "COMPLETED", branchId: "south" },
      ],
      workflowActionExecutions: [
        { executionId: "north-execution", branchId: "north",
          actionType: "CREATE_ATTENTION", state: "SUCCEEDED" },
        { executionId: "south-execution", branchId: "south",
          actionType: "CREATE_ATTENTION", state: "SUCCEEDED" },
      ],
    } as unknown as Partial<Snapshot>));
    expect(results).toEqual({
      savedRequests: 1, sentQuotes: 1, acceptedQuotes: 1,
      recordedVisits: 1, savedInvoices: 1, completedInternalAttention: 1,
    });
  });

  it("does not credit a same-workspace invoice linked to another visit or accepted quote", () => {
    const results = summarizeOwnerOperationalEvidence(values({
      requests: [request("req-a")],
      quotes: [quote("accepted", "req-a", "ACCEPTED")],
      visits: [{ id: "visit-good", requestId: "req-a", quoteId: "accepted" }],
      invoices: [
        { id: "good", quoteId: "accepted", visitId: "visit-good" },
        { id: "unlinked", quoteId: "accepted", visitId: "visit-other" },
        { id: "legacy", quoteId: "accepted" },
      ],
    } as unknown as Partial<Snapshot>));
    expect(results.savedInvoices).toBe(2);
  });

  it("never upgrades an undefined or unauthorized selected branch into visible success", () => {
    const result = summarizeOwnerOperationalEvidence(values({
      branchScope: { mode: "BRANCH", selectedBranchId: "north",
        branches: [{id:"north",code:"US-N",name:"North",
          timezone:"America/New_York",currency:"USD"}]},
      requests: [{id:"unknown", status:"NEW"},{id:"foreign",status:"NEW",branchId:"south"}],
      quotes: [quote("q", "foreign", "ACCEPTED")],
      workflowAvailable: true,
      workflowExecutions: [{ id:"x", branchId:"south", mode:"LIVE",
        eventType:"QUOTE_ACCEPTED",matched:true,state:"COMPLETED" }],
      workflowActionExecutions: [{ executionId:"x",branchId:"south",
        actionType:"CREATE_ATTENTION",state:"SUCCEEDED" }],
    } as unknown as Partial<Snapshot>));
    expect(result.savedRequests).toBe(0);
    expect(result.acceptedQuotes).toBe(0);
    expect(result.completedInternalAttention).toBe(0);
  });

  it("requires quote currency to match its saved authorized branch, never guesses conversion", () => {
    const report = summarizeOwnerOperationalEvidence(values({
      branchScope: { mode: "ALL", branches: [
        { id: "north", code: "US-N", name: "North", currency: "USD",
          timezone: "America/New_York", isDefault: true },
        { id: "london", code: "GB-L", name: "London", currency: "GBP",
          timezone: "Europe/London", isDefault: false },
      ] },
      requests: [
        {id:"north-request",branchId:"north",status:"NEW"},
        {id:"london-request",branchId:"london",status:"NEW"},
      ],
      quotes: [
        quote("north-ok","north-request","ACCEPTED","USD"),
        quote("north-wrong","north-request","ACCEPTED","GBP"),
        quote("london-ok","london-request","SENT","GBP"),
        quote("london-wrong","london-request","ACCEPTED","USD"),
      ],
      visits: [
        {id:"v-good",quoteId:"north-ok",requestId:"north-request",branchId:"north"},
        {id:"v-wrong",quoteId:"north-wrong",requestId:"north-request",branchId:"north"},
      ],
      invoices: [
        {id:"i-good",quoteId:"north-ok",visitId:"v-good"},
        {id:"i-wrong",quoteId:"north-wrong",visitId:"v-wrong"},
      ],
    } as unknown as Partial<Snapshot>));
    expect(report).toMatchObject({savedRequests:2,sentQuotes:2,acceptedQuotes:1,
      recordedVisits:1,savedInvoices:1});
  });

  it("keeps old unscoped legacy records visible but never treats unassigned branch quotes as ready in selected scope", () => {
    const northRequest = {id:"unassigned",status:"NEW"};
    const q = quote("quote-a","unassigned","ACCEPTED","USD");
    expect(summarizeOwnerOperationalEvidence(values({
      requests:[northRequest],quotes:[q],
    } as unknown as Partial<Snapshot>)).acceptedQuotes).toBe(1);
    const blocked=summarizeOwnerOperationalEvidence(values({
      branchScope:{mode:"BRANCH",selectedBranchId:"north",branches:[
        {id:"north",code:"US-N",name:"North",currency:"USD",
          timezone:"America/New_York",isDefault:true}]},
      requests:[northRequest],quotes:[q],
    } as unknown as Partial<Snapshot>));
    expect(blocked.acceptedQuotes).toBe(0);
    expect(blocked.savedRequests).toBe(0);
  });

  it("does not inflate saved workflow progress from repeated record IDs in a joined snapshot", () => {
    const report = summarizeOwnerOperationalEvidence(values({
      requests: [{id:"r1",branchId:"north",status:"NEW"}],
      quotes: [
        quote("q1","r1","ACCEPTED"),
        quote("q1","r1","ACCEPTED"),
      ],
      visits: [
        {id:"v1",quoteId:"q1",requestId:"r1",branchId:"north"},
        {id:"v1",quoteId:"q1",requestId:"r1",branchId:"north"},
      ],
      invoices: [
        {id:"i1",quoteId:"q1",visitId:"v1"},
        {id:"i1",quoteId:"q1",visitId:"v1"},
      ],
      workflowAvailable:true,workflowExecutions:[],workflowActionExecutions:[],
    } as unknown as Partial<Snapshot>));
    expect(report).toMatchObject({savedRequests:1,sentQuotes:1,acceptedQuotes:1,
      recordedVisits:1,savedInvoices:1,completedInternalAttention:0});
  });

  it("does not use duplicated or missing record IDs to manufacture an accepted quote chain", () => {
    const report = summarizeOwnerOperationalEvidence(values({
      requests:[{id:"r1",status:"NEW"}],
      quotes:[
        quote("","r1","ACCEPTED"),
        quote("q1","r1","SENT"),
        quote("q1","r1","ACCEPTED"),
      ],
      visits:[
        {id:"",quoteId:"q1",requestId:"r1"},
        {id:"v1",quoteId:"q1",requestId:"r1"},
      ],
      invoices:[
        {id:"",quoteId:"q1",visitId:"v1"},
        {id:"i1",quoteId:"q1",visitId:"v1"},
      ],
    } as unknown as Partial<Snapshot>));
    // An ambiguous second copy of q1 cannot upgrade the first persisted
    // SENT record to ACCEPTED or certify an invoice.
    expect(report).toMatchObject({sentQuotes:1,acceptedQuotes:0,
      recordedVisits:0,savedInvoices:0});
  });

  it("UI is read-only and links owners to real modules, with no fabricated provider receipts", () => {
    const ui = readFileSync(join(process.cwd(),
      "src/features/onboarding/OnboardingOperationalEvidencePanel.tsx"), "utf8");
    for (const text of ["savedRequests", "acceptedQuotes", "completedInternalAttention",
      "No record yet", "Not verified", "External WhatsApp, email, Stripe"]) {
      expect(ui).toContain(text);
    }
    expect(ui).toContain("buildStaffModuleHref(workspaceSlug, step.module)");
    expect(ui).not.toContain("sendWhatsApp(");
    expect(ui).not.toContain("service_role");
    expect(ui).not.toContain("createClient(");
  });
});
