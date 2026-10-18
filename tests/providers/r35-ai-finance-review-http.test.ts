import {describe,expect,it} from "vitest";
import {handleOwnerFinanceReviewPost} from "../../src/server/api-handlers/ai-finance-review-http";
const url="https://servicedesk.example.test/api/internal/ai/finance-review";
const request=(raw:string, origin="https://servicedesk.example.test",method="POST")=>
 new Request(url,{method,headers:{
  "content-type":"application/json","origin":origin,
  "sec-fetch-site":"same-origin",
 },...(method==="POST"?{body:raw}:{})});
const saved={ok:true as const,value:{
 state:"FINANCE_OWNER_MANUAL_REVIEW" as const,workspaceId:"workspace-a",
 source:"AUTHORIZED_SAVED_INVOICE_SNAPSHOT" as const,inspectedCount:1,
 exceptionCount:1,exceptions:[{invoiceId:"invoice-a" as string,
  priority:"NORMAL" as const,codes:["ISSUED_BALANCE_REVIEW" as const]}],
 paymentConfirmed:false as const,refundAuthorized:false as const,
 providerMessageQueued:false as const,
}};
describe("SONIC L24 owner finance read-only HTTP boundary",()=>{
 it("permits a one-field same-origin owner request and returns saved evidence only",async()=>{
  let called=0;
  const r=await handleOwnerFinanceReviewPost(request('{"workspaceSlug":"qa-cleaning"}'),
   async slug=>{called++;expect(slug).toBe("qa-cleaning");return saved;});
  expect(r.status).toBe(200);expect(called).toBe(1);
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  const data=await r.json();
  expect(data).toMatchObject({state:"FINANCE_OWNER_MANUAL_REVIEW",
   paymentConfirmed:false,source:"AUTHORIZED_SAVED_INVOICE_SNAPSHOT"});
 });
 it("rejects cross-origin calls and unexpected browser supplied financial fields",async()=>{
  const run=async()=>{throw Error("should not reach service")};
  const other=await handleOwnerFinanceReviewPost(request('{"workspaceSlug":"qa-cleaning"}',
    "https://untrusted.example.test"),run);
  expect(other.status).toBe(403);
  const forged=await handleOwnerFinanceReviewPost(request(
   '{"workspaceSlug":"qa-cleaning","role":"OWNER","totalMinor":1}'),run);
  expect(forged.status).toBe(400);
 });
 it("does not leak raw server errors or cross-owner source diagnostics",async()=>{
  const r=await handleOwnerFinanceReviewPost(request('{"workspaceSlug":"qa-cleaning"}'),
   async()=>({ok:false,code:"FINANCE_OWNER_REQUIRED"}));
  expect(r.status).toBe(403);
  expect(await r.json()).toEqual({code:"FINANCE_OWNER_REQUIRED"});
  const error=await handleOwnerFinanceReviewPost(request('{"workspaceSlug":"qa-cleaning"}'),
    async()=>{throw Error("Bearer personal-private-key");});
  expect(error.status).toBe(503);
  expect(JSON.stringify(await error.json())).not.toContain("personal-private-key");
 });
});
