import {describe,expect,it} from "vitest";
import {callAiModel} from "../../src/server/ai/model-transport";
const config={
 apiBaseUrl:"https://api.openai.com/v1",apiKey:"fictional-test-key",
 model:"synthetic",timeoutMs:500,now:()=>new Date().toISOString(),
};
const input={promptVersion:"critic-r44",conversationId:"conversation-1",
 workspaceId:"workspace-1",userText:"Synthetic request for test only"};
describe("R44 independent critic — cancellation cannot be turned into provider success",()=>{
 it("rejects a synchronous forged 200 if client cancels inside the model transport",async()=>{
   const caller=new AbortController();
   let called=0;
   const result=await callAiModel(config,{...input,signal:caller.signal},async()=>{
     called++;
     caller.abort();
     return {status:200,body:JSON.stringify({
       output:{},replyDraft:"This looks approved",
     })};
   });
   expect(called).toBe(1);
   expect(result).toMatchObject({ok:false,code:"AI_MODEL_CANCELLED"});
 });
 it("does not open a paid provider connection with a pre-aborted client signal",async()=>{
   const caller=new AbortController();caller.abort();
   let called=0;
   const result=await callAiModel(config,{...input,signal:caller.signal},async()=>{
     called++;return {status:200,body:'{"output":{}}'};
   });
   expect(called).toBe(0);
   expect(result).toMatchObject({ok:false,code:"AI_MODEL_CANCELLED"});
 });
});
