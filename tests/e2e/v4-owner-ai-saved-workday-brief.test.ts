import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
import {deriveOwnerOperationsBriefFacts,generateOwnerOperationsBrief,validateOwnerOperationsBriefGrounding} from "../../src/server/ai/owner-operations-brief";

const workspaceId="11111111-1111-4111-8111-111111111111";
const actorId="22222222-2222-4222-8222-222222222222";
const snapshot={
  loadedAt:"2026-10-16T12:00:00.000Z",
  workspace:{id:workspaceId,slug:"ctg",name:"Private name",timezone:"UTC"},
  actor:{workspaceId,userId:actorId,role:"OWNER"},
  requests:[{id:"customer-request-private",status:"NEW"}],
  quotes:[{id:"quote-private",requestId:"customer-request-private",status:"SENT",
    validUntil:"2026-10-15T12:00:00.000Z",version:1}],
  invoices:[{id:"invoice-private",quoteId:"quote-private",status:"PARTIALLY_PAID",
    currency:"USD",totalMinor:24000,allocatedMinor:9000,refundedMinor:2000,balanceMinor:17000}],
  visits:[{id:"visit-private",status:"CONFIRMED",crewId:undefined}],
  attentionItems:[{id:"attention-private",status:"OPEN",severity:"CRITICAL"}],
};
const authorized=()=>({ok:true,value:{
  workspace:snapshot.workspace,actor:snapshot.actor,
  service:{},branchScope:{mode:"ALL",branches:[]},
}} as never);
function deps(persisted=()=>snapshot,receive:(p:string)=>void=()=>{}) {
  return {
    resolveActor:async()=>authorized(),
    loadSnapshot:async()=>({ok:true,value:persisted()} as never),
    now:()=>Date.parse("2026-10-16T12:14:00.000Z"),
    readConfig:()=>({ok:true,value:{
      apiBaseUrl:"https://api.openai.com/v1",apiKey:"mock-only",
      model:"test-model",now:()=>new Date().toISOString(),
    }}),
    callModel:async(_cfg:unknown,request:{userText:string})=>{
      receive(request.userText);
      return {ok:true,value:{output:{},replyDraft:
        "Review unassigned visits and expired quotes, then inspect the invoice ledger before contacting customers.",
        requestedToolCalls:[],citations:[]}};
    },
  } as never;
}
describe("real authorized AI daily owner operations brief",()=>{
  it("counts only persisted scope fields, ignores IDs and prices",()=>{
    expect(deriveOwnerOperationsBriefFacts(snapshot as never)).toEqual({
      openRequests:1,waitingOnCustomerQuotes:0,quoteValidityNeedsReview:1,
      collectibleInvoices:1,invoiceLedgersNeedingReview:0,
      unassignedActiveVisits:1,unresolvedCriticalAttentions:1,
    });
  });
  it("calls model only for verified owner and forwards numeric counts, not PII or money",async()=>{
    let prompt="";
    const result=await generateOwnerOperationsBrief("ctg",deps(()=>snapshot,s=>prompt=s));
    expect(result).toMatchObject({ok:true,value:{
      state:"OWNER_AI_ADVISORY_ONLY",source:"AUTHORIZED_SAVED_WORKSPACE_COUNTS",
    }});
    expect(prompt).toContain('"quoteValidityNeedsReview":1');
    for(const privateValue of ["customer-request-private","invoice-private","Private name","24000","17000",actorId,workspaceId])
      expect(prompt).not.toContain(privateValue);
  });
  it("rejects nonowners and stale saved business counts even after a paid model call",async()=>{
    const denied=await generateOwnerOperationsBrief("ctg",{
      resolveActor:async()=>({ok:false,kind:"authentication",message:"denied"}),
    } as never);
    expect(denied).toMatchObject({ok:false,code:"OWNER_BRIEF_OWNER_REQUIRED"});
    let reads=0;
    const stale=await generateOwnerOperationsBrief("ctg",deps(()=>{
      reads++;return reads===1?snapshot:{...snapshot,requests:[]};
    }));
    expect(stale).toMatchObject({ok:false,code:"OWNER_BRIEF_STALE_SNAPSHOT"});
  });
  it("refuses invented exact counts, false completion claims and empty-queue priorities",()=>{
    const base=deriveOwnerOperationsBriefFacts(snapshot as never)!;
    for(const ungrounded of [
      "Review 14 unassigned visits before the shift.",
      "Check two overdue invoices and send an update.",
      "All invoices are settled. Review the financial report.",
      "No quotes require attention; check the calendar.",
      "We have resolved the customer issues; check the new queue.",
      "Review critical attention items tomorrow.",
    ]) {
      // The last category exists in this fixture and remains permitted,
      // while hallucinated numeric and completed-action claims are blocked.
      const expected=ungrounded==="Review critical attention items tomorrow.";
      expect(Boolean(validateOwnerOperationsBriefGrounding(ungrounded,base)),ungrounded)
        .toBe(expected);
    }
    const empty={...base,unassignedActiveVisits:0,quoteValidityNeedsReview:0,
      waitingOnCustomerQuotes:0,invoiceLedgersNeedingReview:0,openRequests:0,
      unresolvedCriticalAttentions:0,collectibleInvoices:0};
    for(const copy of [
      "Review unassigned visits.","Inspect expired quotes.","Review open requests.",
      "Inspect critical attention items.","Check outstanding invoices.",
      "Inspect invoice ledger issues.","Follow up on quotes awaiting customers.",
    ]) expect(validateOwnerOperationsBriefGrounding(copy,empty),copy).toBeUndefined();
    expect(validateOwnerOperationsBriefGrounding(
      "Check the authoritative workspace queues before making changes.",empty))
      .toBe("Check the authoritative workspace queues before making changes.");
  });
  it("rejects an ungrounded AI output after saving verified counts rather than surfacing it",async()=>{
    const config=deps();
    const result=await generateOwnerOperationsBrief("ctg",{
      ...config,
      callModel:async()=>({ok:true,value:{replyDraft:
        "Review 12 expired quotes and zero unassigned visits.",
        requestedToolCalls:[],citations:[]}}),
    } as never);
    expect(result).toMatchObject({ok:false,code:"OWNER_BRIEF_OUTPUT_UNSAFE"});
  });
  it("requires recent source evidence before and after model latency, even for identical counts",async()=>{
    const base=deps();
    const stale=await generateOwnerOperationsBrief("ctg",{
      ...base,now:()=>Date.parse("2026-10-16T13:00:01Z"),
    } as never);
    expect(stale).toMatchObject({ok:false,code:"OWNER_BRIEF_STALE_SNAPSHOT"});
    const future=await generateOwnerOperationsBrief("ctg",{
      ...base,now:()=>Date.parse("2026-10-16T11:54:00Z"),
    } as never);
    expect(future).toMatchObject({ok:false,code:"OWNER_BRIEF_STALE_SNAPSHOT"});
    let clockCalls=0;
    const changedDuringModel=await generateOwnerOperationsBrief("ctg",{
      ...base,
      now:()=>++clockCalls===1
        ? Date.parse("2026-10-16T12:14:00Z")
        : Date.parse("2026-10-16T12:40:01Z"),
    } as never);
    expect(changedDuringModel)
      .toMatchObject({ok:false,code:"OWNER_BRIEF_STALE_SNAPSHOT"});
    expect(await generateOwnerOperationsBrief("ctg",{
      ...base,now:()=>Number.NaN,
    } as never)).toMatchObject({ok:false,code:"OWNER_BRIEF_STALE_SNAPSHOT"});
  });
  it("requires deliberate owner UI and never sends or charges",()=>{
    const view=readFileSync(join(process.cwd(),"src/features/operations/StaffOverviewDashboard.tsx"),"utf8");
    const ui=readFileSync(join(process.cwd(),"src/features/operations/AiOwnerOperationsBrief.tsx"),"utf8");
    expect(view).toContain('snapshot.actor?.role === "OWNER"');
    expect(ui).toContain("Generate owner AI priorities");
    expect(ui).toContain("requestOwnerOperationsBrief(workspaceSlug)");
    expect(ui).not.toContain("sendWhatsApp");
    expect(ui).not.toContain("applyManualPayment");
  });
});
