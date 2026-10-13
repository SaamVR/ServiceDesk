import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  generateAuthorizedQuoteReview,
  type QuoteReviewDependencies,
} from "../../src/server/ai/quote-review";

const workspaceId="11111111-1111-4111-8111-111111111111";
const quoteId="22222222-2222-4222-8222-222222222222";
const quote={
  id:quoteId,workspace_id:workspaceId,version:1,status:"APPROVED",
  valid_until:"2099-01-01T00:00:00.000Z",
  subtotal_minor:20000,tax_minor:0,total_minor:20000,
  deposit_minor:5000,balance_minor:15000,duration_minutes:120,
  snapshot:{lineItems:[{
    code:"BASE",description:"Standard cleaning",
    amountMinor:20000,durationMinutes:120,
  }]},
};
function setup(afterModel:()=>void):QuoteReviewDependencies {
  const service={from:()=>({
    select(){return this;},eq(){return this;},
    async maybeSingle(){return {data:quote,error:null};},
  })};
  return {
    resolveActor:async()=>({ok:true,value:{
      workspace:{id:workspaceId,slug:"ctg"},
      actor:{workspaceId,userId:"owner-1",role:"OWNER"},
      service,branchScope:{mode:"ALL",branches:[]},
    }} as never),
    authorizeQuote:async()=>undefined,
    readConfig:()=>({ok:true,value:{
      apiBaseUrl:"https://api.openai.com/v1",apiKey:"fake",
      model:"model-mock",timeoutMs:2000,maxOutputTokens:512,
    }} as never),
    callModel:async()=>{afterModel();return {ok:true,value:{
      replyDraft:"Check that the saved standard cleaning scope matches the customer's request.",
      requestedToolCalls:[],citations:[],
    }} as never;},
  };
}
describe("post-model staff authorization and tenant recheck",()=>{
  test("revoked sign-in while provider runs must never surface a suggestion",async()=>{
    let revoked=false;
    const d=setup(()=>{revoked=true;});
    const first=d.resolveActor!;
    d.resolveActor=async slug=>revoked?{ok:false,kind:"authentication",message:"revoked"} as never:first(slug);
    const result=await generateAuthorizedQuoteReview({workspaceSlug:"ctg",quoteId},d);
    expect(result).toMatchObject({ok:false,code:"AI_QUOTE_STAFF_ACCESS_REVOKED"});
  });
  test("same session but changed staff identity cannot inherit paid output",async()=>{
    let changed=false;
    const d=setup(()=>{changed=true;});
    const first=d.resolveActor!;
    d.resolveActor=async slug=>{
      const resolved=await first(slug);
      return changed&&resolved.ok ? {ok:true,value:{
        ...resolved.value,actor:{...resolved.value.actor,userId:"other-staff"},
      }} as never : resolved;
    };
    const result=await generateAuthorizedQuoteReview({workspaceSlug:"ctg",quoteId},d);
    expect(result).toMatchObject({ok:false,code:"AI_QUOTE_STAFF_ACCESS_REVOKED"});
  });
  test("branch access revoked during call is rechecked before quote readback",async()=>{
    let checks=0;
    const d=setup(()=>{});
    d.authorizeQuote=async()=>++checks===1?undefined:{ok:false,message:"branch denied"} as never;
    const result=await generateAuthorizedQuoteReview({workspaceSlug:"ctg",quoteId},d);
    expect(result).toMatchObject({ok:false,code:"AI_QUOTE_STAFF_ACCESS_REVOKED"});
    expect(checks).toBe(2);
  });
  test("still returns a staff-only review when membership and saved quote stay valid",async()=>{
    const result=await generateAuthorizedQuoteReview({workspaceSlug:"ctg",quoteId},setup(()=>{}));
    expect(result).toMatchObject({ok:true,value:{state:"AI_STAFF_REVIEW_ONLY",quoteId}});
  });
  test("second tenant authorization precedes post-model persistence readback",()=>{
    const src=readFileSync(join(process.cwd(),"src/server/ai/quote-review.ts"),"utf8");
    const model=src.indexOf("const response = await");
    const reauth=src.indexOf("AI_QUOTE_STAFF_ACCESS_REVOKED",model);
    const lookup=src.indexOf('current = await active.service.from("quotes")',model);
    expect(model).toBeGreaterThan(-1);
    expect(reauth).toBeGreaterThan(model);
    expect(lookup).toBeGreaterThan(reauth);
  });
});
