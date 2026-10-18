import {describe,expect,it} from "vitest";
import {executeAuthorizedStaffAiTurn} from "../../src/server/ai/staff-invocation";
import {ApprovedKnowledgeIndex} from "../../src/server/ai/knowledge";
import type {ResolvedStaffActor} from "../../src/features/operations/operational-product-runtime";

const baseConv={id:"conv-1",workspace_id:"ws-1",request_id:"req-1",
 customer_id:"customer-1",channel:"EMAIL",handover_active:false};
const baseMessage={id:"msg-1",workspace_id:"ws-1",conversation_id:"conv-1",
 direction:"INBOUND",sender_kind:"CUSTOMER",body:"Please quote a deep clean.",
 created_at:"2026-10-18T01:00:00.000Z"};
const modelReply=JSON.stringify({object:"response",status:"completed",
 output:[{type:"message",content:[{type:"output_text",text:JSON.stringify({
 output:{corrections:[],unsupportedReasons:[],riskFlags:[]},
 replyDraft:"Staff should review the saved enquiry.",
 requestedToolCalls:[],citations:[],
 })}]}]});
const invocation={workspaceSlug:"cleaning-qa",conversationId:"conv-1",messageId:"msg-1"};
function fixture(opts:{afterRole?:string;afterUser?:string;afterConversation?:Record<string,unknown>;
 afterMessage?:Record<string,unknown>;afterBranch?:string}={}){
 let auth=0,conversationReads=0,messageReads=0,calls=0;
 const from=(table:string)=>{
   const api={
     select(_s:string){return api;},
     eq(_k:string,_v:unknown){return api;},
     async maybeSingle(){
       if(table==="conversations"){
         conversationReads++;
         return {data:conversationReads>1 && opts.afterConversation?
           opts.afterConversation:baseConv,error:null};
       }
       if(table==="messages"){
         messageReads++;
         return {data:messageReads>2 && opts.afterMessage?
           opts.afterMessage:baseMessage,error:null};
       }
       return {data:null,error:null};
     },
   };
   return api;
 };
 const resolver=async()=>{
   auth++;
   const actor={workspaceId:"ws-1",userId:auth>1?opts.afterUser??"owner-1":"owner-1",
     role:auth>1?opts.afterRole??"OWNER":"OWNER"};
   return {ok:true as const,value:{
     actor,workspace:{id:"ws-1",slug:"cleaning-qa"},
     branchScope:{mode:"ALL",branches:[],selectedBranchId:opts.afterBranch},
     service:{from},rpc:{},
   } as unknown as ResolvedStaffActor};
 };
 const data={
   resolveActor:resolver,
   knowledge:new ApprovedKnowledgeIndex([]),
   env:{SERVICEDESK_AI_ENABLED:"true",OPENAI_API_KEY:"test-only-key",
     SERVICEDESK_AI_MODEL:"controlled-model"},
   fetchPort:async()=>{calls++;return new Response(modelReply,{status:200});},
 };
 return {data,counts:()=>({auth,conversationReads,messageReads,calls})};
}
describe("SONIC R36 staff AI post-provider saved authority",()=>{
 it("returns draft only after another matching owner, conversation and message check",async()=>{
   const x=fixture();
   expect(await executeAuthorizedStaffAiTurn(invocation,x.data)).toMatchObject({ok:true});
   expect(x.counts()).toMatchObject({auth:2,conversationReads:2,messageReads:3,calls:1});
 });
 it("rejects role and user revocation after one actual simulated model request",async()=>{
   for(const change of [{afterRole:"CUSTOMER"},{afterUser:"different-user"}]){
     const x=fixture(change);
     expect(await executeAuthorizedStaffAiTurn(invocation,x.data)).toMatchObject({
       ok:false,code:"AI_STAFF_ACCESS_REVOKED"});
     expect(x.counts().calls).toBe(1);
   }
 });
 it("refuses a changed handover or moved customer without releasing model text",async()=>{
   for(const afterConversation of [
     {...baseConv,handover_active:true},{...baseConv,customer_id:"foreign"},
     {...baseConv,request_id:"different-request"},
   ]) {
     const x=fixture({afterConversation});
     const r=await executeAuthorizedStaffAiTurn(invocation,x.data);
     expect(r).toMatchObject({ok:false,code:"AI_STAFF_SOURCE_CHANGED"});
     expect(JSON.stringify(r)).not.toContain("Staff should review");
   }
 });
 it("independent critic: refuses a switched provider channel or inbound message author",async()=>{
    const switched=fixture({afterConversation:{...baseConv,channel:"WHATSAPP"}});
    expect(await executeAuthorizedStaffAiTurn(invocation,switched.data))
      .toMatchObject({ok:false,code:"AI_STAFF_SOURCE_CHANGED"});
    const forged=fixture({afterMessage:{...baseMessage,sender_kind:"STAFF",direction:"OUTBOUND"}});
    expect(await executeAuthorizedStaffAiTurn(invocation,forged.data))
      .toMatchObject({ok:false,code:"AI_STAFF_SOURCE_CHANGED"});
    expect(switched.counts().calls).toBe(1);
    expect(forged.counts().calls).toBe(1);
  });
 it("refuses a changed inbound message body after the model used the original",async()=>{
   const x=fixture({afterMessage:{...baseMessage,body:"different sensitive message"}});
   expect(await executeAuthorizedStaffAiTurn(invocation,x.data))
     .toMatchObject({ok:false,code:"AI_STAFF_SOURCE_CHANGED"});
 });
});
