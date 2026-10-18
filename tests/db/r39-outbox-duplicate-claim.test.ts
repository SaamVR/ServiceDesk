import {describe,expect,it} from "vitest";
import {createDurableOutboxRepository,type DurableOutboxRow,type DurableOutboxTableGateway}
 from "../../src/server/jobs/outbox-repository";
const row:DurableOutboxRow={
 id:"outbox-one",workspaceId:"workspace-one",topic:"booking.confirmed",
 payload:{visitId:"visit-one"},status:"PENDING",attempts:1,
 idempotencyKey:"visit-one:booking",lockedBy:"worker-one",
 lockedAt:"2026-10-18T09:00:00.000Z",
 createdAt:"2026-10-18T08:59:00.000Z",updatedAt:"2026-10-18T09:00:00.000Z",
};
const client=(source:unknown)=>createDurableOutboxRepository({
 claimReady:async()=>({data:source,error:null}),
 markSent:async()=>({data:null,error:null}),
 markRetry:async()=>({data:null,error:null}),
 markFailed:async()=>({data:null,error:null}),
 markSuppressed:async()=>({data:null,error:null}),
} as DurableOutboxTableGateway);
const run=(source:unknown)=>client(source).claimReady("worker-one",row.lockedAt!,60,10);
describe("SONIC R39 L18 durable outbox claim de-duplication",()=>{
 it("passes one real safely leased event to the worker with exact source identity",async()=>{
   await expect(run([row])).resolves.toMatchObject({ok:true,value:[{
     id:row.id,workspaceId:row.workspaceId,idempotencyKey:row.idempotencyKey,
     lockedBy:"worker-one",attempt:1,
   }]});
 });
 it("rejects duplicate row ID or duplicate workspace-key across distinct IDs before any execution",async()=>{
   for(const source of [
     [row,{...row}],
     [row,{...row,id:"outbox-two"}],
     [row,{...row,id:"outbox-two",workspaceId:"workspace-two",idempotencyKey:"new-key"},row],
   ]) await expect(run(source)).resolves.toMatchObject({
       ok:false,code:"OUTBOX_CLAIM_ROWS_INVALID"
     });
 });
 it("refuses forged completed rows, invalid attempts, malformed arrays and page overflow",async()=>{
   for(const source of [
     [{...row,status:"SENT"}],
     [{...row,attempts:0}],
     [{...row,attempts:Infinity}],
     new Array(2),
     Array.from({length:11},(_,i)=>({...row,id:"outbox-"+i,idempotencyKey:"key-"+i})),
     "provider-pretending-array",
   ]) await expect(run(source)).resolves.toMatchObject({ok:false,code:"OUTBOX_CLAIM_ROWS_INVALID"});
 });
 it("retains the worker lease mismatch signal instead of forging ownership",async()=>{
   const result=await run([{...row,lockedBy:"worker-two"}]);
   expect(result).toMatchObject({ok:true,value:[{lockedBy:"worker-two"}]});
 });
});
