import {describe,expect,it,vi} from "vitest";
import {readF15CompleteSavedLeadFacts} from "../../src/server/workflows/sonic-f15-complete-saved-source";
const workspaceId="11111111-1111-4111-8111-111111111111";
const branchId="22222222-2222-4222-8222-222222222222";
const requestId="33333333-3333-4333-8333-333333333333";
const conversationId="44444444-4444-4444-8444-444444444444";
const customerId="55555555-5555-4555-8555-555555555555";
const source=()=>({
 requests:[{id:requestId,workspace_id:workspaceId,branch_id:branchId,
  version:3,status:"NEW",created_at:"2026-10-29T07:00:00Z",customer_id:customerId}],
 conversations:[{id:conversationId,workspace_id:workspaceId,branch_id:branchId,
  request_id:requestId,customer_id:customerId}],
 messages:[{id:"66666666-6666-4666-8666-666666666666",workspace_id:workspaceId,
  conversation_id:conversationId,direction:"INBOUND",sender_kind:"CUSTOMER",
  created_at:"2026-10-29T07:10:00Z"}],
});
function fake(tables:ReturnType<typeof source>){
 const from=vi.fn((table:string)=>{
  let filters:Array<[string,unknown]>=[];
  const query={
   select:(_columns:string)=>query,
   eq:(column:string,value:unknown)=>{filters.push([column,value]);return query;},
   async maybeSingle(){
    const list=(tables as unknown as Record<string,Record<string,unknown>[]>)[table].filter(row=>
      filters.every(([k,v])=>row[k]===v));
    return {data:list.length===1?list[0]:null,error:list.length>1?{code:"AMBIGUOUS"}:null};
   },
   async limit(n:number){
    const list=(tables as unknown as Record<string,Record<string,unknown>[]>)[table].filter(row=>
      filters.every(([k,v])=>row[k]===v));
    return {data:list.slice(0,n),error:null};
   },
  };
  return query;
 });
 return {from};
}
describe("F15 trusted source collector: complete saved inbound/reply evidence",()=>{
 it("reconstructs one scoped lead only with current complete saved message history",async()=>{
  const db=fake(source());
  const r=await readF15CompleteSavedLeadFacts(db as never,workspaceId,branchId,requestId);
  expect(r).toMatchObject({workspaceId,branchId,requestId,version:3,status:"NEW",
   lastInboundMessageId:"66666666-6666-4666-8666-666666666666",
   lastStaffResponseAt:null,responseHistoryComplete:true});
  expect(db.from).toHaveBeenCalledWith("requests");
  expect(db.from).toHaveBeenCalledWith("conversations");
  expect(db.from).toHaveBeenCalledWith("messages");
 });
 it("includes saved staff response and correctly refuses to mark as unanswered",async()=>{
  const tables=source();
  tables.messages.push({...tables.messages[0],
   id:"77777777-7777-4777-8777-777777777777",direction:"OUTBOUND",
   sender_kind:"STAFF",created_at:"2026-10-29T07:30:00Z"});
  const r=await readF15CompleteSavedLeadFacts(fake(tables) as never,workspaceId,branchId,requestId);
  expect(r?.lastStaffResponseAt).toBe("2026-10-29T07:30:00Z");
 });
 it("rejects full-page truncation and linked sibling customer conversations",async()=>{
  const list=source();
  list.messages=Array.from({length:201},(_,i)=>({
   ...list.messages[0],
   id:"66666666-6666-4666-8666-"+String(i+1).padStart(12,"0"),
  }));
  expect(await readF15CompleteSavedLeadFacts(fake(list) as never,
    workspaceId,branchId,requestId)).toBeNull();
  const sibling=source();
  sibling.conversations.push({...sibling.conversations[0],
   id:"88888888-8888-4888-8888-888888888888",request_id:"99999999-9999-4999-8999-999999999999"});
  expect(await readF15CompleteSavedLeadFacts(fake(sibling) as never,
    workspaceId,branchId,requestId)).toBeNull();
 });
 it("refuses foreign branch and malformed saved records",async()=>{
  const db=fake(source());
  expect(await readF15CompleteSavedLeadFacts(db as never,workspaceId,
   "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",requestId)).toBeNull();
  const broken=source();broken.requests[0].status="BOOKED";
  expect(await readF15CompleteSavedLeadFacts(fake(broken) as never,
   workspaceId,branchId,requestId)).toBeNull();
 });
});
