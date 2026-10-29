import {describe,expect,it} from "vitest";
import {reviewF07SavedAiActionUsage,type F07UsageDeps,type F07UsageSource}
 from "../../src/server/ai/f07-saved-ai-usage-review";
const ws="11111111-1111-4111-8111-111111111111",
 user="22222222-2222-4222-8222-222222222222",
 rowId="33333333-3333-4333-8333-333333333333",
 name="test-workspace",now=()=>Date.parse("2026-10-25T06:00:00Z");
function source():F07UsageSource{
 return {limitValue:100,rows:[{
  id:rowId,workspaceId:ws,metric:"AI_ACTIONS",
  periodStart:"2026-10-01T00:00:00.000Z",periodEnd:"2026-11-01T00:00:00.000Z",
  used:85,updatedAt:"2026-10-24T05:00:00.000Z",
 }]};
}
function fixture(opts:{first?:(v:F07UsageSource)=>void;
 second?:(v:F07UsageSource)=>void;role?:string;userChanged?:boolean;denied?:boolean}={}){
 let resolves=0,reads=0;
 const deps={
  now,resolveActor:async()=>{resolves++;return opts.denied?{ok:false}:
    {ok:true,value:{workspace:{id:ws,slug:name},
      actor:{role:opts.role??"OWNER",workspaceId:ws,
        userId:opts.userChanged&&resolves>1?"44444444-4444-4444-8444-444444444444":user},
      service:{}}};},
  readSaved:async()=>{reads++;const v=structuredClone(source());
   (reads===1?opts.first:opts.second)?.(v);return v;},
 } as unknown as F07UsageDeps;
 return {deps,counts:()=>({resolves,reads})};
}
const run=(d:F07UsageDeps)=>reviewF07SavedAiActionUsage(name,d);
describe("F07 saved AI_ACTIONS count is NOT provider token cost",()=>{
 it("warns at 80% AI_ACTIONS usage while refusing to invent money or token charges",async()=>{
  const f=fixture(),r=await run(f.deps);
  expect(r).toMatchObject({ok:true,value:{
   state:"F07_OWNER_SAVED_AI_ACTION_USAGE_REVIEW",
   source:"DOUBLE_READ_SCOPED_AI_ACTION_COUNTERS_NOT_TOKEN_BILLING",
   workspaceId:ws,inspectedPeriods:1,
   currentUsed:85,currentLimit:100,
   currentPeriodStart:"2026-10-01T00:00:00.000Z",
   evidenceDigest:expect.stringMatching(/^[a-f0-9]{64}$/),
   warnings:["MODEL_SPEND_AMOUNT_UNVERIFIED","AI_ACTION_LIMIT_APPROACHING"],
   modelPriceAndTokensUnavailable:true,actualModelCostUnverified:true,
   spendAmountMinor:null,currency:null,
   operatorReviewRequired:true,usageConsumed:false,
   modelInvoked:false,providerCalled:false,customerMessaged:false,
  }});
  expect(f.counts()).toEqual({resolves:2,reads:2});
 });
 it("classifies reached limits from saved count, never as model billing amount",async()=>{
  const patch=(v:F07UsageSource)=>{v.rows[0].used=100;};
  const r=await run(fixture({first:patch,second:patch}).deps);
  expect(r).toMatchObject({ok:true,value:{
   warnings:["MODEL_SPEND_AMOUNT_UNVERIFIED","AI_ACTION_LIMIT_REACHED"],
   currentUsed:100,spendAmountMinor:null,
  }});
 });
 it("honestly refuses to imply zero model spend with zero saved counter history",async()=>{
  const p=(v:F07UsageSource)=>{v.rows=[];v.limitValue=null;};
  expect(await run(fixture({first:p,second:p}).deps))
    .toMatchObject({ok:true,value:{currentUsed:null,spendAmountMinor:null,
     warnings:["MODEL_SPEND_AMOUNT_UNVERIFIED","AI_ACTION_USAGE_HISTORY_NOT_PROVEN"]}});
 });
 it("refuses foreign tenant counters, duplicate periods, corrupted numeric evidence and poison dates",async()=>{
  const cases=[
   (v:F07UsageSource)=>{v.rows[0].workspaceId="foreign";},
   (v:F07UsageSource)=>{v.rows[0].used=-1;},
   (v:F07UsageSource)=>{v.rows[0].used=Number.NaN;},
   (v:F07UsageSource)=>{v.rows[0].periodEnd="2026-02-30T00:00:00Z";},
   (v:F07UsageSource)=>{v.rows[0].periodEnd=v.rows[0].periodStart;},
   (v:F07UsageSource)=>{v.rows.push({...v.rows[0],id:"55555555-5555-4555-8555-555555555555"});},
   (v:F07UsageSource)=>{v.rows[0].metric="OUTBOUND_MESSAGES" as never;},
   (v:F07UsageSource)=>{Object.defineProperty(v.rows[0],"apiKey",{value:"sk_live_secret"});},
  ];
  for(const p of cases)expect((await run(fixture({first:p}).deps)).ok).toBe(false);
 });
 it("refuses owner revocation and source count/limit revisions between two reads",async()=>{
  const changed=[
   (v:F07UsageSource)=>{v.rows[0].used=99;},
   (v:F07UsageSource)=>{v.rows[0].updatedAt="2026-10-25T04:00:00.000Z";},
   (v:F07UsageSource)=>{v.limitValue=90;},
  ];
  for(const patch of changed)
   expect(await run(fixture({second:patch}).deps))
    .toMatchObject({ok:false,code:"F07_USAGE_SOURCE_CHANGED"});
  expect(await run(fixture({userChanged:true}).deps))
   .toMatchObject({ok:false,code:"F07_USAGE_SOURCE_CHANGED"});
  expect(await run(fixture({role:"CREW"}).deps))
   .toMatchObject({ok:false,code:"F07_USAGE_OWNER_REQUIRED"});
  expect(await run(fixture({denied:true}).deps))
   .toMatchObject({ok:false,code:"F07_USAGE_OWNER_REQUIRED"});
 });
 it("blocks hidden, accessor, sparse, oversized usage proof and never contacts providers",async()=>{
  const cases=[
   (v:F07UsageSource)=>{Object.defineProperty(v,"publish",{value:true});},
   (v:F07UsageSource)=>{Object.defineProperty(v.rows,"secret",{value:1});},
   (v:F07UsageSource)=>{Object.defineProperty(v.rows[0],"leakedReceipt",{
      get:()=>{throw Error("unsafe");}});},
   (v:F07UsageSource)=>{v.rows=Array.from({length:201},(_,i)=>({
    ...v.rows[0],id:rowId,periodStart:"2026-10-01T00:00:00.000Z"}));},
  ];
  for(const patch of cases)
   expect((await run(fixture({first:patch}).deps)).ok).toBe(false);
 });
 it("cancels before authorization and declines malformed workspace slugs",async()=>{
  const c=new AbortController();c.abort();const f=fixture();
  expect(await run({...f.deps,signal:c.signal}))
   .toMatchObject({ok:false,code:"F07_USAGE_CANCELLED"});
  expect(f.counts()).toEqual({resolves:0,reads:0});
  expect(await reviewF07SavedAiActionUsage("INVALID SLUG"))
   .toMatchObject({ok:false,code:"F07_USAGE_INPUT_INVALID"});
 });
});
