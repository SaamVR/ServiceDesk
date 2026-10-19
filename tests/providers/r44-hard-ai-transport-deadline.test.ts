import { afterEach, describe, expect, it, vi } from "vitest";
import { callAiModel, type AiModelTransportConfig } from "../../src/server/ai/model-transport";

const input={promptVersion:"r44-provider-time-bound",workspaceId:"workspace-1",
 conversationId:"conversation-1",userText:"Synthetic owner test only"};
const config:AiModelTransportConfig={
 apiBaseUrl:"https://api.openai.com/v1",apiKey:"fictional-key",
 model:"synthetic-model",timeoutMs:500,now:()=>new Date().toISOString(),
};
const success={status:200,body:JSON.stringify({output:{},replyDraft:"Review saved records only"})};

afterEach(()=>vi.useRealTimers());

describe("R44 AI provider termination even with broken HTTP adapters",()=>{
 it("terminates a hanging HTTP adapter at the hard provider deadline",async()=>{
   vi.useFakeTimers();
   const observed:AbortSignal[]=[];
   const result=callAiModel(config,input,async req=>{
     observed.push(req.signal);
     return new Promise<never>(()=>{}); // intentionally violates AbortSignal
   });
   await vi.advanceTimersByTimeAsync(499);
   expect(observed[0]?.aborted).toBe(false);
   await vi.advanceTimersByTimeAsync(1);
   expect(await result).toMatchObject({ok:false,code:"AI_MODEL_TIMEOUT"});
   expect(observed[0]?.aborted).toBe(true);
 });
 it("caller cancellation stops a hung adapter before the provider deadline",async()=>{
   vi.useFakeTimers();
   const caller=new AbortController();
   const result=callAiModel({...config,timeoutMs:30_000},
     {...input,signal:caller.signal},async ()=>new Promise<never>(()=>{}));
   caller.abort();
   expect(await result).toMatchObject({ok:false,code:"AI_MODEL_CANCELLED"});
 });
 it("rejects a 200 provider draft arriving after the deadline",async()=>{
   vi.useFakeTimers();
   const result=callAiModel(config,input,async ()=>{
     await new Promise(resolve=>setTimeout(resolve,700));
     return success;
   });
   await vi.advanceTimersByTimeAsync(700);
   expect(await result).toMatchObject({ok:false,code:"AI_MODEL_TIMEOUT"});
 });
 it("successful bounded provider response still works without tool grants",async()=>{
   expect(await callAiModel(config,input,async()=>success))
     .toMatchObject({ok:true,value:{replyDraft:"Review saved records only"}});
 });
 it("gateway adapter cannot stall forever despite its larger approved budget",async()=>{
   vi.useFakeTimers();
   const gateway:AiModelTransportConfig={
      ...config,provider:"codex_gateway",
      approvedGatewayOrigin:"https://codex-api.ezcomo.shop",
      gatewayAllowedWorkspaceId:input.workspaceId,
      apiBaseUrl:"https://codex-api.ezcomo.shop/v1",timeoutMs:60_000,
   };
   const result=callAiModel(gateway,input,async()=>new Promise<never>(()=>{}));
   await vi.advanceTimersByTimeAsync(60_000);
   expect(await result).toMatchObject({ok:false,code:"AI_MODEL_TIMEOUT"});
 });
});
