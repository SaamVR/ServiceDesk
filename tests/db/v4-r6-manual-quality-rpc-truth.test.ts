import { describe, expect, it, vi } from "vitest";
import type { ActorContext, CommandMeta } from "../../src/contracts";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";
import { createPostgresManualPaymentQualityFacadeMethods } from "../../src/server/core/manual-quality-postgres";

const ctx = { workspaceId:"11111111-1111-4111-8111-111111111111",userId:"22222222-2222-4222-8222-222222222222",role:"OWNER" } as ActorContext;
const meta = { now:"2026-10-16T10:00:00.000Z",idempotencyKey:"r6-synthetic" } as CommandMeta;
const id = "33333333-3333-4333-8333-333333333333";
const invoice = { id,workspaceId:ctx.workspaceId,status:"PAID",currency:"USD",
  totalMinor:10000,allocatedMinor:10000,refundedMinor:0,balanceMinor:0 };
const caseRow = { id,workspaceId:ctx.workspaceId,visitId:"44444444-4444-4444-8444-444444444444",
  state:"RESOLVED",reviewRequestState:"ELIGIBLE",feedbackScore:5,
  summary:"Reviewed by human operator",version:2,createdAt:"2026-10-16T10:00:00Z",
  updatedAt:"2026-10-16T10:00:00Z" };
function facade(data: unknown, error: unknown = null) {
  const rpc=vi.fn().mockResolvedValue({data,error});
  return { methods:createPostgresManualPaymentQualityFacadeMethods({rpc} as unknown as SupabaseRpcClient),rpc };
}
const payInput = { amountMinor:10000,currency:"USD",method:"CASH" as const,
  reference:"RECEIPT-123",occurredAt:"2026-10-16T10:00:00.000Z" };
describe("R6 authoritative manual payment and quality RPC boundary",()=>{
  it("accepts only reconciled, same-tenant, same-invoice receipt",async()=>{
    const {methods}=facade({ok:true,invoice});
    expect(await methods.applyManualPayment(ctx,id,payInput,meta))
      .toMatchObject({ok:true,value:{id,workspaceId:ctx.workspaceId,status:"PAID"}});
  });
  it("never accepts false-paid or foreign invoice projections",async()=>{
    for(const patch of [
      {workspaceId:"foreign"}, {id:"unrelated"}, {currency:"usd"},
      {totalMinor:10001}, {balanceMinor:100}, {allocatedMinor:9000},
      {allocatedMinor:10000.5},{totalMinor:Number.MAX_SAFE_INTEGER+1},
      {refundedMinor:10001},{balanceMinor:-1}
    ]){
      const {methods}=facade({ok:true,invoice:{...invoice,...patch}});
      expect(await methods.applyManualPayment(ctx,id,payInput,meta),
        JSON.stringify(patch)).toMatchObject({ok:false,code:"MANUAL_PAYMENT_RPC_ERROR_MALFORMED"});
    }
  });
  it("does not expose raw database secrets, forged error codes or thrown RPC messages",async()=>{
    for(const payload of [
      {data:null,error:{code:"secret:bearer",message:"Bearer 123 customer@example.com"}},
      {data:{ok:false,code:"AUTH\nBearer secret"},error:null},
    ]){
      const {methods}=facade(payload.data,payload.error);
      const out=await methods.applyManualPayment(ctx,id,payInput,meta);
      expect(out.ok).toBe(false);
      expect(JSON.stringify(out)).not.toMatch(/Bearer|customer@example.com|secret/);
    }
    const rpc=vi.fn().mockRejectedValue(Error("SUPABASE_KEY=secret"));
    const methods=createPostgresManualPaymentQualityFacadeMethods({rpc} as unknown as SupabaseRpcClient);
    expect(await methods.applyManualPayment(ctx,id,payInput,meta))
      .toMatchObject({ok:false,code:"MANUAL_PAYMENT_RPC_UNAVAILABLE"});
  });
  it("accepts valid quality actions but refuses foreign IDs, invented states and invalid scores",async()=>{
    const {methods}=facade({ok:true,qualityCase:caseRow});
    expect(await methods.applyQualityCaseAction(ctx,id,"RESOLVE",{resolutionNote:"Done"},meta))
      .toMatchObject({ok:true,value:{id,state:"RESOLVED"}});
    for(const patch of [
      {id:"foreign"},{workspaceId:"foreign"},{state:"APPROVED"},
      {reviewRequestState:"AUTO_SENT"},{version:-1},{version:1.5},
      {feedbackScore:6},{feedbackScore:2.25}
    ]){
      const f=facade({ok:true,qualityCase:{...caseRow,...patch}}).methods;
      expect(await f.applyQualityCaseAction(ctx,id,"RESOLVE",{resolutionNote:"Done"},meta))
        .toMatchObject({ok:false,code:"QUALITY_CASE_RPC_ERROR_MALFORMED"});
    }
  });
});
