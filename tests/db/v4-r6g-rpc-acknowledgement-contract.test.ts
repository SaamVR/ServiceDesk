import {describe,expect,it,vi} from "vitest";
import {createPostgresManualPaymentQualityFacadeMethods} from "../../src/server/core/manual-quality-postgres";
import {createPostgresPaymentApplicationFacadeMethods} from "../../src/server/core/payment-application-postgres";
import {createPostgresConversationFacadeMethods} from "../../src/server/core/conversation-postgres";
import type {SupabaseRpcClient} from "../../src/server/core/payment-application-postgres";

function rpcWith(data:unknown):SupabaseRpcClient {
  return {rpc:vi.fn().mockResolvedValue({data,error:null})} as unknown as SupabaseRpcClient;
}
const actor={workspaceId:"11111111-1111-4111-8111-111111111111",userId:"22222222-2222-4222-8222-222222222222",role:"OWNER"} as never;
const meta={expectedVersion:1,idempotencyKey:"r6g-test",now:"2026-10-16T09:00:00Z"} as never;
const payment={provider:"stripe",providerEventId:"evt1",providerTransactionId:"pi1",
 providerAccountId:"acct1",workspaceId:"11111111-1111-4111-8111-111111111111",
 purpose:"DEPOSIT",amountMinor:10000,currency:"USD",occurredAt:"2026-10-16T09:00:00Z"} as never;
describe("R6G literal SQL ok true acknowledgement is the sole business-success authority",()=>{
  const invalid=[undefined,null,false,0,1,"true","yes",{},[]];
  it("manual payment and quality cases reject absent/nonboolean SQL success flags",async()=>{
    for(const bad of invalid){
      const database=rpcWith({ok:bad,invoice:{},qualityCase:{}});
      const facade=createPostgresManualPaymentQualityFacadeMethods(database);
      const paid=await facade.applyManualPayment(actor,"invoice1",{
        amountMinor:10000,currency:"USD",method:"CASH",reference:"receipt1",
        occurredAt:"2026-10-16T09:00:00Z",
      },meta);
      const quality=await facade.applyQualityCaseAction(actor,"quality1","RESOLVE",{},meta);
      expect(paid).toMatchObject({ok:false,code:"MANUAL_PAYMENT_RPC_ERROR"});
      expect(quality).toMatchObject({ok:false,code:"QUALITY_CASE_RPC_ERROR"});
    }
  });
  it("verified payment never accepts a missing or string-valued success receipt",async()=>{
    for(const bad of invalid){
      const facade=createPostgresPaymentApplicationFacadeMethods(rpcWith({ok:bad,state:"APPLIED"}));
      expect(await facade.applyVerifiedPayment(payment)).toMatchObject({
        ok:false,code:"PAYMENT_RPC_REJECTED",
      });
    }
  });
  it("inbox RPC never treats a truthy string as authorized queued message",async()=>{
    for(const bad of invalid){
      const facade=createPostgresConversationFacadeMethods(rpcWith({ok:bad}));
      const queued=await facade.enqueueConversationReply(actor,"conversation1",{
        body:"Approved human reply",channel:"EMAIL",
      },meta);
      const snapshot=await facade.readWorkspaceSnapshot(actor,{});
      expect(queued).toMatchObject({ok:false,code:"REPLY_RPC_ERROR"});
      expect(snapshot).toMatchObject({ok:false,code:"SNAPSHOT_RPC_ERROR"});
    }
  });
  it("a literal true still advances to normal, independently validated data mapping",async()=>{
    const manual=await createPostgresManualPaymentQualityFacadeMethods(rpcWith({ok:true,invoice:{}}))
      .applyManualPayment(actor,"invoice1",{
        amountMinor:10000,currency:"USD",method:"CASH",reference:"receipt1",occurredAt:"2026-10-16T09:00:00Z",
      },meta);
    expect(manual).toMatchObject({ok:false,code:"MANUAL_PAYMENT_RPC_ERROR_MALFORMED"});
    const paymentResult=await createPostgresPaymentApplicationFacadeMethods(rpcWith({ok:true,state:"INVENTED"}))
      .applyVerifiedPayment(payment);
    expect(paymentResult).toMatchObject({ok:false,code:"PAYMENT_RPC_MALFORMED"});
    const inbox=await createPostgresConversationFacadeMethods(rpcWith({ok:true,conversations:[]}))
      .readWorkspaceSnapshot(actor,{});
    expect(inbox).toMatchObject({ok:true,value:{conversations:[]}});
  });
});
