import {describe,it,expect,vi} from "vitest";
import {readFileSync} from "node:fs";
import {loadAuthorizedF15InboxSlaReview} from "../../src/server/ai/owner-inbox-f15-sla-review";
import {planF15UnansweredLeadSla} from "../../src/server/workflows/sonic-f15-unanswered-lead-sla";
const workspace="11111111-1111-4111-8111-111111111111";
const branch="22222222-2222-4222-8222-222222222222";
const request="33333333-3333-4333-8333-333333333333";
const conversation="44444444-4444-4444-8444-444444444444";
const message="55555555-5555-4555-8555-555555555555";
const user="66666666-6666-4666-8666-666666666666";
const at=Date.parse("2026-10-29T09:00:00.000Z");
const good=()=>({
 record:{workspaceId:workspace,branchId:branch,requestId:request,version:4,
  status:"NEW",createdAt:"2026-10-29T08:00:00.000Z",
  lastInboundAt:"2026-10-29T08:10:00.000Z",
  lastInboundMessageId:message,lastStaffResponseAt:null,responseHistoryComplete:true},
 conversationId:conversation,channel:"WEB",sourceFingerprint:"saved-request-v4-inbound-message-555",
});
const owner=()=>({ok:true,value:{
 workspace:{id:workspace,slug:"demo-workspace"},
 actor:{workspaceId:workspace,userId:user,role:"OWNER"},
 branchScope:{mode:"ALL",branches:[{id:branch}]},service:{},
}});
const deps=(options:{owner?:()=>Promise<unknown>;read?:()=>Promise<unknown>;now?:()=>number}={})=>({
 resolveActor:(options.owner??(async()=>owner())) as never,
 readSource:(options.read??(async()=>good())) as never,
 now:options.now??(()=>at),
});
describe("F15 saved Inbox SLA operator review",()=>{
 it("returns a real read-only overdue verdict after two authorizations and two saved reads",async()=>{
  const authorize=vi.fn(async()=>owner());
  const read=vi.fn(async()=>good());
  const result=await loadAuthorizedF15InboxSlaReview("demo-workspace",conversation,30,
    deps({owner:authorize,read}));
  expect(result).toMatchObject({ok:true,value:{
    state:"SAVED_INBOX_LEAD_OVERDUE_REVIEW",
    source:"TWO_OWNER_AUTHORIZED_REQUEST_AND_MESSAGE_READS",
    channel:"WEB",requestId:request,sourceVersion:4,thresholdMinutes:30,
    staffReviewRequired:true,eventRecorded:false,externalMessageQueued:false,
    customerMessageSent:false,providerInvoked:false,modelInvoked:false,moneyChanged:false,
  }});
  expect(authorize).toHaveBeenCalledTimes(2);
  expect(read).toHaveBeenCalledTimes(2);
 });
 it("returns NO escalation when the saved staff response is after last inbound",async()=>{
  const res=await loadAuthorizedF15InboxSlaReview("demo-workspace",conversation,60,
    deps({read:async()=>({...good(),record:{
     ...good().record,lastStaffResponseAt:"2026-10-29T08:30:00.000Z"}})}));
  expect(res).toMatchObject({ok:true,value:{
    state:"SAVED_INBOX_LEAD_NO_ESCALATION_DUE",eventRecorded:false,
  }});
 });
 it("fails before any database read for malformed input or wrong owner role/branch scope",async()=>{
  const read=vi.fn(async()=>good());
  for(const [slug,id,min] of [
    ["bad/slug",conversation,60],["demo-workspace","contact@example.org",60],
    ["demo-workspace",conversation,10],
  ] as const){
   expect((await loadAuthorizedF15InboxSlaReview(slug,id,min,deps({read}))).ok).toBe(false);
  }
  for(const patch of [
    {actor:{workspaceId:workspace,userId:user,role:"DISPATCHER"}},
    {branchScope:{mode:"BRANCH",branches:[{id:branch}]}},
    {actor:{workspaceId:branch,userId:user,role:"OWNER"}},
  ]){
   const fake={...owner().value,...patch};
   const res=await loadAuthorizedF15InboxSlaReview("demo-workspace",conversation,60,
     deps({owner:async()=>({ok:true,value:fake}),read}));
   expect(res).toMatchObject({ok:false,code:"F15_REVIEW_OWNER_REQUIRED"});
  }
  expect(read).not.toHaveBeenCalled();
 });
 it("rejects unauthorized branch, incomplete saved history and forged tenant context",async()=>{
  for(const change of [
    {...good(),record:{...good().record,branchId:"77777777-7777-4777-8777-777777777777"}},
    {...good(),record:{...good().record,workspaceId:branch}},
    {...good(),record:{...good().record,responseHistoryComplete:false}},
  ]){
    const res=await loadAuthorizedF15InboxSlaReview("demo-workspace",conversation,60,
      deps({read:async()=>change}));
    expect(res.ok).toBe(false);
  }
 });
 it("rejects changes between the two source reads even when the count stays constant",async()=>{
  const changes=[
    {...good(),sourceFingerprint:"new-staff-reply"},
    {...good(),record:{...good().record,version:5}},
    {...good(),record:{...good().record,lastInboundMessageId:
      "88888888-8888-4888-8888-888888888888"}},
    {...good(),conversationId:"99999999-9999-4999-8999-999999999999"},
  ];
  for(const second of changes){
    let n=0;
    const res=await loadAuthorizedF15InboxSlaReview("demo-workspace",conversation,60,
      deps({read:async()=>++n===1?good():second}));
    expect(res).toMatchObject({ok:false,code:"F15_REVIEW_SOURCE_CHANGED"});
  }
 });
 it("blocks changed actor, source read exceptions and out-of-range clocks",async()=>{
  let n=0;
  const changed=await loadAuthorizedF15InboxSlaReview("demo-workspace",conversation,60,
   deps({owner:async()=>++n===1?owner():{ok:true,value:{...owner().value,
    actor:{workspaceId:workspace,userId:branch,role:"OWNER"}}}}));
  expect(changed).toMatchObject({ok:false,code:"F15_REVIEW_SOURCE_CHANGED"});
  expect((await loadAuthorizedF15InboxSlaReview("demo-workspace",conversation,60,
    deps({read:async()=>{throw Error("raw customer secret");}}))).ok).toBe(false);
  const impossible=await loadAuthorizedF15InboxSlaReview("demo-workspace",conversation,60,
    deps({now:()=>Number.NaN}));
  expect(impossible).toMatchObject({ok:false,code:"F15_REVIEW_SOURCE_UNAVAILABLE"});
 });
 it("the imported SLA core rejects incomplete, unknown or forged staff history",()=>{
  expect(planF15UnansweredLeadSla({record:{
   ...good().record,responseHistoryComplete:false},
   observedAt:"2026-10-29T09:00:00.000Z",thresholdMinutes:60,
  })).toMatchObject({ok:false,code:"F15_EVIDENCE_INVALID"});
 });
 it("Critic: UI and action never assert an event was recorded or sent",()=>{
  const action=readFileSync("src/features/operations/f15-inbox-sla-review-action.ts","utf8");
  const panel=readFileSync("src/features/operations/InboxLeadSlaPanel.tsx","utf8");
  const client=readFileSync("src/features/operations/AiUnansweredLeadSlaReview.tsx","utf8");
  const loader=readFileSync("src/server/ai/owner-inbox-f15-sla-review.ts","utf8");
  const route=readFileSync("src/app/app/[workspace]/inbox/page.tsx","utf8");
  expect(route).toContain("<InboxLeadSlaPanel");
  expect(panel).toContain("loadOperationalStaffSnapshot(workspaceSlug)");
  expect(panel).toContain('result.value.branchScope?.mode!=="ALL"');
  expect(action).toContain("loadAuthorizedF15InboxSlaReview(workspaceSlug,conversationId,thresholdMinutes)");
  expect(action).toContain("eventRecorded:false");
  expect(client).toContain("No durable SLA event");
  expect(loader).toContain("sourceFingerprint!==first.sourceFingerprint");
  expect(loader).toContain('r.customer_id!==null');
  expect(loader).toContain('linked.data.length!==1');
  for(const s of [loader,action,client]){
    expect(s).not.toContain("sendEmail(");
    expect(s).not.toContain("queueApprovedTemplate(");
    expect(s).not.toContain("executeAttentionAction(");
    expect(s).not.toContain("process.env.");
  }
 });
});
