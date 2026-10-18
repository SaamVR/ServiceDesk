import {describe,expect,it} from "vitest";
import {guardAiModelOutput,guardAiToolCalls} from "../../src/server/ai/output-guard";
const basic={serviceCode:"DEEP",bedrooms:2,bathrooms:1,riskFlags:[],
 corrections:[],unsupportedReasons:[]};
describe("SONIC R36 L-A protected AI output and tool proposal completeness",()=>{
 it("retains actual catalog-backed extraction and authorized proposal details",()=>{
  expect(guardAiModelOutput(basic)).toMatchObject({ok:true,value:{serviceCode:"DEEP",bedrooms:2}});
  expect(guardAiToolCalls([{name:"searchApprovedKnowledge",arguments:{query:"deep clean"}}]))
   .toMatchObject([{name:"searchApprovedKnowledge",allowed:true,
      arguments:{query:"deep clean"}}]);
 });
 it("rejects unexpected provider/financial keys instead of discarding them",()=>{
  for(const extra of [{paymentConfirmed:true},{claimRefund:true},{toolCalls:[{name:"sendProviderMessage"}]},
    {customerSecret:"PII"},{hasOven:"yes"}]){
   expect(guardAiModelOutput({...basic,...extra}))
     .toMatchObject({ok:false,code:"AI_OUTPUT_INVALID"});
  }
  expect(guardAiModelOutput({...basic,paymentPaid:true}))
   .toMatchObject({ok:false,code:"AI_BUSINESS_TRUTH_FORBIDDEN"});
 });
 it("rejects hidden properties, accessors, inherited models and out-of-bounds user-facing strings",()=>{
  const h=Object.defineProperty({...basic},"paymentAuthorized",{value:true,enumerable:false});
  const getter=Object.defineProperty({...basic},"area",{get(){throw Error("untrusted getter");},
    enumerable:true});
  for(const value of [h,getter,Object.assign(Object.create({admin:true}),basic),
   {...basic,area:"a".repeat(241)},{...basic,hasOven:1},
   {...basic,customerName:"Control\u202ename"},{...basic,corrections:Array(17).fill("a")},
   {...basic,unsupportedReasons:["a".repeat(241)]}]){
    expect(()=>guardAiModelOutput(value)).not.toThrow();
    expect(guardAiModelOutput(value)).toMatchObject({ok:false});
  }
 });
 it("refuses entire >8 proposal batch rather than silently truncating a dangerous ninth call",()=>{
   const good={name:"getServiceCatalog",arguments:{}};
   const calls=guardAiToolCalls([...Array(8).fill(good),
    {name:"markPaymentPaid",arguments:{id:"invoice"}}]);
   expect(calls).toHaveLength(1);
   expect(calls[0]).toMatchObject({name:"requestHumanReview",allowed:true});
 });
 it("routes nested attacker inputs and accessor tool args to human review without execution",()=>{
  const hidden=Object.defineProperty({name:"getServiceCatalog",arguments:{}},"sendProviderMessage",
   {value:true,enumerable:false});
  const getter=Object.defineProperty({name:"getServiceCatalog"},"arguments",{
   enumerable:true,get(){throw Error("accessor execution");}
  });
  for(const input of [hidden,getter,
   {name:"getServiceCatalog",arguments:{target:{nested:{too:{deep:{value:"no"}}}}}},
   {name:"getServiceCatalog",arguments:{emails:["x".repeat(800)]}},
   {name:"getServiceCatalog",arguments:Array(2).fill("x")}]){
   expect(()=>guardAiToolCalls([input])).not.toThrow();
   expect(guardAiToolCalls([input])).toMatchObject([{name:"requestHumanReview"}]);
  }
 });
});
