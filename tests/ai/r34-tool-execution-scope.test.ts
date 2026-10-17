import {describe,expect,it} from "vitest";
import {planAiToolOrchestration} from "../../src/server/ai/tool-orchestration";
const scoped={workspaceId:"workspace-a",allowedRequestIds:["req-1"],allowedCustomerIds:["customer-1"]};
const plan=(scope:typeof scoped,args:unknown,tool="calculateQuote")=>
 planAiToolOrchestration({scope,requestedToolCalls:[{name:tool,arguments:args}]});
describe("SONIC R34 L17 AI tool proposals require exact authorized resource membership",()=>{
 it("preserves already-authorized facade-only tool proposals",()=>{
  expect(plan(scoped,{requestId:"req-1"})).toMatchObject({
   accepted:[{name:"calculateQuote",executionBoundary:"SERVICE_DESK_FACADE_ONLY",
     canMutateBusinessTruth:false}],businessMutationAllowed:false,
  });
 });
 it("rejects absent resource allowlists rather than interpreting undefined as all customers",()=>{
  expect(plan({...scoped,allowedRequestIds:undefined},{requestId:"req-1"}).rejected)
    .toMatchObject([{reason:"RESOURCE_OUT_OF_SCOPE"}]);
  expect(plan({...scoped,allowedCustomerIds:undefined},{customerId:"customer-1"},"getCustomerBookingSummary").rejected)
    .toMatchObject([{reason:"RESOURCE_OUT_OF_SCOPE"}]);
  expect(plan(scoped,{requestId:"req-unknown"}).rejected)
    .toMatchObject([{reason:"RESOURCE_OUT_OF_SCOPE"}]);
 });
 it("rejects getter, prototype and hidden arguments without invoking the getter",()=>{
  const getter=Object.defineProperty({},"requestId",{enumerable:true,get(){throw Error("secret read");}});
  expect(()=>plan(scoped,getter)).not.toThrow();
  expect(plan(scoped,getter).rejected).toMatchObject([{reason:"SCHEMA_VIOLATION"}]);
  const inherited=Object.assign(Object.create({requestId:"req-1"}),{});
  expect(plan(scoped,inherited).rejected).toMatchObject([{reason:"SCHEMA_VIOLATION"}]);
  const hidden=Object.defineProperty({requestId:"req-1"},"customerEmail",{value:"private@example.test"});
  expect(plan(scoped,hidden).rejected).toMatchObject([{reason:"SCHEMA_VIOLATION"}]);
 });
 it("redacts malicious unknown tool names from diagnostics",()=>{
  const r=planAiToolOrchestration({scope:scoped,requestedToolCalls:[
    {name:"Bearer private.customer@example.test",arguments:{}},
  ]});
  expect(r.rejected).toMatchObject([{name:"unknown",reason:"UNKNOWN_TOOL"}]);
  expect(JSON.stringify(r)).not.toMatch(/Bearer|private\.customer/);
 });
 it("never executes with null scope",()=>{
  const r=planAiToolOrchestration({scope:null as unknown as typeof scoped,
    requestedToolCalls:[{name:"getServiceCatalog",arguments:{}}]});
  expect(r).toMatchObject({accepted:[],rejected:[{reason:"RESOURCE_OUT_OF_SCOPE"}],
    businessMutationAllowed:false});
 });
});
