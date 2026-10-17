import { describe, expect, it } from "vitest";
import { summarizeSavedRequestLifecycle } from "../../src/features/operations/saved-request-lifecycle";
import type { OperationalRequest, OperationalQuote, OperationalVisit, OperationalInvoice } from "../../src/features/operations/operational-product-runtime";

const request = { id:"request-a", status:"READY", version:2, serviceLabel:"Deep cleaning" } as OperationalRequest;
const quote = {id:"quote-a",requestId:request.id,version:2,status:"ACCEPTED",currency:"USD",totalMinor:10000,depositMinor:2500,
  balanceMinor:7500,durationMinutes:90,bufferMinutes:20} as OperationalQuote;
const job = {id:"job-a",requestId:request.id,quoteId:quote.id,status:"IN_PROGRESS", workspaceId:"workspace-a",
  startAt:"2026-10-18T10:00:00Z",serviceMinutes:90,bufferMinutes:20,version:1} as OperationalVisit;
const invoice = {id:"invoice-a",quoteId:quote.id,status:"OPEN",currency:"USD"} as unknown as OperationalInvoice;
const build=(patch: {quotes?:OperationalQuote[];visits?:OperationalVisit[];invoices?:OperationalInvoice[]}={}) =>
  summarizeSavedRequestLifecycle({request,quotes:patch.quotes??[quote],visits:patch.visits??[job],invoices:patch.invoices??[invoice]});

describe("V4 saved real request lifecycle handoff", () => {
  it("follows exact request -> unambiguous current quote -> matching visit/quote invoice only", () => {
    const out=build();
    expect(out.steps.map(step=>step.status)).toEqual(["RECORDED","ACCEPTED","IN_PROGRESS","RECORDED"]);
    expect(out.steps.map(step=>step.recordId)).toEqual([request.id,quote.id,job.id,invoice.id]);
    expect(out.disclosure).toContain("not proof");
  });
  it("shows missing loaded records honestly, never invents job or invoice", () => {
    const out=build({quotes:[],visits:[],invoices:[]});
    expect(out.steps.slice(1).map(step=>step.status)).toEqual(["NOT_OBSERVED","NOT_OBSERVED","NOT_OBSERVED"]);
    expect(out.steps.slice(1).every(step=>step.recordId===undefined)).toBe(true);
  });
  it("rejects tied highest-version quotes and blocks all associated downstream navigation", () => {
    const conflict={...quote,id:"quote-b"};
    const out=build({quotes:[quote,conflict]});
    expect(out.steps[1].status).toBe("REVIEW_REQUIRED");
    expect(out.steps[1].recordId).toBeUndefined();
    expect(out.steps[2].status).toBe("NOT_OBSERVED");
    expect(out.steps[3].recordId).toBeUndefined();
  });
  it("selects latest non-superseded quote and never joins old-version job and invoice", () => {
    const recent={...quote,id:"quote-latest",version:3,status:"APPROVED"};
    const out=build({quotes:[quote,recent]});
    expect(out.steps[1].recordId).toBe(recent.id);
    expect(out.steps[1].status).toBe("READY_FOR_STAFF");
    expect(out.steps[2].recordId).toBeUndefined();
    expect(out.steps[3].recordId).toBeUndefined();
  });
  it("excludes foreign request and wrong-quote associations even when IDs look valid", () => {
    const out=build({visits:[{...job,requestId:"another-request"}],
      invoices:[{...invoice,quoteId:"another-quote"}]});
    expect(out.steps[2].status).toBe("NOT_OBSERVED");
    expect(out.steps[3].status).toBe("NOT_OBSERVED");
  });
  it("treats saved SENT as awaiting customer, never as delivery receipt", () => {
    const out=build({quotes:[{...quote,status:"SENT"}],visits:[],invoices:[]});
    expect(out.steps[1].status).toBe("AWAITING_CUSTOMER");
    expect(out.steps[1].detail).toContain("provider delivery");
  });
  it("does not choose among multiple competing job or invoice records", () => {
    const out=build({visits:[job,{...job,id:"job-b"}],invoices:[invoice,{...invoice,id:"invoice-b"}]});
    expect(out.steps[2].status).toBe("REVIEW_REQUIRED");
    expect(out.steps[2].recordId).toBeUndefined();
    expect(out.steps[3].status).toBe("REVIEW_REQUIRED");
    expect(out.steps[3].recordId).toBeUndefined();
  });
  it("distinguishes a paid saved ledger status from external settlement", () => {
    const out=build({invoices:[{...invoice,status:"PAID"}]});
    expect(out.steps[3].status).toBe("COMPLETED");
    expect(out.steps[3].detail).toContain("separate proof");
  });
});
