import {describe,expect,it} from "vitest";
import {loadAuthorizedF15InboxSlaReview} from "../../src/server/ai/owner-inbox-f15-sla-review";
const w="11111111-1111-4111-8111-111111111111";
const b="22222222-2222-4222-8222-222222222222";
const req="33333333-3333-4333-8333-333333333333";
const c="44444444-4444-4444-8444-444444444444";
const inbound="55555555-5555-4555-8555-555555555555";
const customer="66666666-6666-4666-8666-666666666666";
const staff="77777777-7777-4777-8777-777777777777";
const actor="88888888-8888-4888-8888-888888888888";
const at=Date.parse("2026-10-29T10:00:00.000Z");

function fixture(options:{secondConversation?:boolean;replied?:boolean;foreignSibling?:boolean;status?:string}={}){
 const rows:Record<string,Record<string,unknown>[]> ={
  conversations:[{id:c,workspace_id:w,branch_id:b,request_id:req,
    customer_id:customer,channel:"EMAIL",version:4}],
  requests:[{id:req,workspace_id:w,branch_id:b,customer_id:customer,
    status:options.status??"NEW",version:7,created_at:"2026-10-29T08:00:00.000Z"}],
  messages:[{id:inbound,workspace_id:w,conversation_id:c,direction:"INBOUND",
    sender_kind:"CUSTOMER",created_at:"2026-10-29T08:30:00.000Z"}],
 };
 if(options.secondConversation)rows.conversations.push({
  id:"99999999-9999-4999-8999-999999999999",workspace_id:w,branch_id:b,
  request_id:req,customer_id:customer,channel:"EMAIL",version:1,
 });
 if(options.foreignSibling)rows.conversations.push({
  id:"99999999-9999-4999-8999-999999999999",workspace_id:w,
  branch_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",request_id:null,
  customer_id:customer,channel:"WEB",version:1,
 });
 if(options.replied)rows.messages.push({
  id:staff,workspace_id:w,conversation_id:c,direction:"OUTBOUND",
  sender_kind:"STAFF",created_at:"2026-10-29T08:35:00.000Z",
 });
 const calls:string[]=[];
 const service={from:(table:string)=>({
  select:(_fields:string)=>{
   const equals:Record<string,unknown>={};
   let amount=100;
   let orderings:Array<{field:string;ascending:boolean}>=[];
   const materialize=()=>{
    let selected=(rows[table]??[]).filter(row=>
      Object.entries(equals).every(([k,v])=>row[k]===v));
    for(const ord of [...orderings].reverse()){
     selected=[...selected].sort((a,b)=>{
      const x=String(a[ord.field]??""),y=String(b[ord.field]??"");
      return ord.ascending?x.localeCompare(y):y.localeCompare(x);
     });
    }
    return selected.slice(0,amount);
   };
   const query={
    eq(key:string,value:unknown){equals[key]=value;return query;},
    order(field:string,params:{ascending:boolean}){orderings.push({field,ascending:params.ascending});return query;},
    limit(n:number){amount=n;return query;},
    async maybeSingle(){calls.push(table+":single");
      const selected=materialize();return {data:selected.length===1?selected[0]:null,error:null};},
    then(resolve:(value:unknown)=>unknown,reject?:(error:unknown)=>unknown){
      calls.push(table+":list");return Promise.resolve({data:materialize(),error:null}).then(resolve,reject);
    },
   };
   return query;
  },
 })};
 const verified={
  ok:true,value:{workspace:{id:w,slug:"demo-workspace"},
   actor:{workspaceId:w,userId:actor,role:"OWNER"},
   branchScope:{mode:"ALL",branches:[{id:b}]},service,
  },
 };
 return {calls,verified};
}
describe("F15 real saved PostgreSQL query path through an injected Supabase-like query client",()=>{
 it("reads linked conversations and real inbound/staff messages twice, not a browser snapshot",async()=>{
  const f=fixture();
  const result=await loadAuthorizedF15InboxSlaReview("demo-workspace",c,60,{
   resolveActor:(async()=>f.verified) as never,now:()=>at,
  });
  expect(result).toMatchObject({ok:true,value:{
   state:"SAVED_INBOX_LEAD_OVERDUE_REVIEW",requestId:req,channel:"EMAIL",
   eventRecorded:false,customerMessageSent:false,providerInvoked:false,
  }});
  expect(f.calls.filter(x=>x==="messages:single")).toHaveLength(4);
  expect(f.calls.filter(x=>x==="conversations:list")).toHaveLength(4);
 });
 it("does not classify a recorded staff reply as an overdue unanswered lead",async()=>{
  const f=fixture({replied:true});
  const result=await loadAuthorizedF15InboxSlaReview("demo-workspace",c,60,{
   resolveActor:(async()=>f.verified) as never,now:()=>at,
  });
  expect(result).toMatchObject({ok:true,value:{
   state:"SAVED_INBOX_LEAD_NO_ESCALATION_DUE",eventRecorded:false,
  }});
 });
 it("refuses another conversation linked to the same request",async()=>{
  const f=fixture({secondConversation:true});
  const result=await loadAuthorizedF15InboxSlaReview("demo-workspace",c,60,{
   resolveActor:(async()=>f.verified) as never,now:()=>at,
  });
  expect(result).toMatchObject({ok:false,code:"F15_REVIEW_SOURCE_INCOMPLETE"});
 });
 it("refuses customer messages split across a second conversation in another branch",async()=>{
  const f=fixture({foreignSibling:true});
  const result=await loadAuthorizedF15InboxSlaReview("demo-workspace",c,60,{
   resolveActor:(async()=>f.verified) as never,now:()=>at,
  });
  expect(result).toMatchObject({ok:false,code:"F15_REVIEW_SOURCE_INCOMPLETE"});
 });
 it("a quoted lead is not silently relabeled an overdue uncontacted lead",async()=>{
  const f=fixture({status:"QUOTED"});
  const result=await loadAuthorizedF15InboxSlaReview("demo-workspace",c,60,{
   resolveActor:(async()=>f.verified) as never,now:()=>at,
  });
  expect(result).toMatchObject({ok:true,value:{
   state:"SAVED_INBOX_LEAD_NO_ESCALATION_DUE",eventRecorded:false,
  }});
 });
});
