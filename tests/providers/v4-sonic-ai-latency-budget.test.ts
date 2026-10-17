import {afterEach, describe, expect, it, vi} from "vitest";
import {readConfiguredAiRuntimeConfig} from "../../src/server/ai/runtime-config";
import {callAiModel, type AiModelHttpRequest} from "../../src/server/ai/model-transport";

const fictionalWorkspace = "11111111-1111-4111-8111-111111111111";
const gatewayEnv = {
  SERVICEDESK_AI_ENABLED: "true",
  SERVICEDESK_AI_PROVIDER: "codex_gateway",
  SERVICEDESK_CODEX_GATEWAY_ENABLED: "true",
  SERVICEDESK_CODEX_GATEWAY_TEST_WORKSPACE_ID: fictionalWorkspace,
  SERVICEDESK_CODEX_GATEWAY_KEY: "fictional-test-only-credential",
  SERVICEDESK_AI_MODEL: "codex",
};
const officialEnv = {
  SERVICEDESK_AI_ENABLED: "true",
  OPENAI_API_KEY: "fictional-official-key",
  SERVICEDESK_AI_MODEL: "gpt-6",
};
const input = {
  promptVersion: "sonic-r32-latency-budget-test",
  conversationId: "fictional-synthetic-only",
  workspaceId: fictionalWorkspace,
  userText: "Return a fictional structured JSON response.",
};

afterEach(()=>vi.useRealTimers());
describe("SONIC AI provider-scoped latency budget",()=>{
  it("uses 45s only for a separately opted-in fictional-workspace Codex gateway",()=>{
    expect(readConfiguredAiRuntimeConfig(gatewayEnv)).toMatchObject({
      ok:true,value:{provider:"codex_gateway",timeoutMs:45_000}
    });
    expect(readConfiguredAiRuntimeConfig({...gatewayEnv,SERVICEDESK_AI_TIMEOUT_MS:"60000"}))
      .toMatchObject({ok:true,value:{timeoutMs:60_000}});
    expect(readConfiguredAiRuntimeConfig({...gatewayEnv,SERVICEDESK_AI_TIMEOUT_MS:"60001"}))
      .toMatchObject({ok:false,code:"AI_RUNTIME_TIMEOUT_INVALID"});
    expect(readConfiguredAiRuntimeConfig({...gatewayEnv,SERVICEDESK_AI_TIMEOUT_MS:"Infinity"}))
      .toMatchObject({ok:false,code:"AI_RUNTIME_TIMEOUT_INVALID"});
    expect(readConfiguredAiRuntimeConfig({...gatewayEnv,SERVICEDESK_AI_TIMEOUT_MS:"30000.5"}))
      .toMatchObject({ok:false,code:"AI_RUNTIME_TIMEOUT_INVALID"});
  });
  it("preserves official OpenAI 10s default and strict 30s maximum",()=>{
    expect(readConfiguredAiRuntimeConfig(officialEnv))
      .toMatchObject({ok:true,value:{timeoutMs:10_000}});
    expect(readConfiguredAiRuntimeConfig({...officialEnv,SERVICEDESK_AI_TIMEOUT_MS:"30000"}))
      .toMatchObject({ok:true,value:{timeoutMs:30_000}});
    expect(readConfiguredAiRuntimeConfig({...officialEnv,SERVICEDESK_AI_TIMEOUT_MS:"30001"}))
      .toMatchObject({ok:false,code:"AI_RUNTIME_TIMEOUT_INVALID"});
    expect(readConfiguredAiRuntimeConfig({...gatewayEnv,SERVICEDESK_CODEX_GATEWAY_ENABLED:"false"}))
      .toMatchObject({ok:false,code:"AI_RUNTIME_GATEWAY_DISABLED"});
  });
  it("keeps the live gateway call alive after the old 30s cap and times out at the 45s default",async()=>{
    vi.useFakeTimers();
    const r=readConfiguredAiRuntimeConfig(gatewayEnv);
    if (!r.ok) throw Error("invalid fictional gateway fixture");
    let sourceSignal:AbortSignal|undefined;
    const pending=callAiModel(r.value,input,async(req:AiModelHttpRequest)=>{
      sourceSignal=req.signal;
      return new Promise((_resolve,reject)=>{
        req.signal.addEventListener("abort",()=>{
          const failure = new Error("aborted");
          failure.name="AbortError";
          reject(failure);
        },{once:true});
      });
    });
    expect(sourceSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(30_001);
    expect(sourceSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(sourceSignal?.aborted).toBe(true);
    expect(await pending).toMatchObject({ok:false,code:"AI_MODEL_TIMEOUT"});
  });
  it("cancels immediately on the caller signal despite the longer gateway budget",async()=>{
    const r=readConfiguredAiRuntimeConfig(gatewayEnv);
    if (!r.ok) throw Error("invalid fictional gateway fixture");
    const controller=new AbortController();
    controller.abort();
    const http=vi.fn();
    expect(await callAiModel(r.value,{...input,signal:controller.signal},http))
      .toMatchObject({ok:false,code:"AI_MODEL_CANCELLED"});
    expect(http).not.toHaveBeenCalled();
  });
  it("cannot bypass the 60s ceiling through an injected gateway config",async()=>{
    vi.useFakeTimers();
    const r=readConfiguredAiRuntimeConfig(gatewayEnv);
    if (!r.ok) throw Error("invalid fictional gateway fixture");
    let sourceSignal:AbortSignal|undefined;
    const pending=callAiModel({...r.value,timeoutMs:999_999},input,async request=>{
      sourceSignal=request.signal;
      return new Promise((_resolve,reject)=>{
        request.signal.addEventListener("abort",()=>{
          const failure=new Error("bounded abort");
          failure.name="AbortError";
          reject(failure);
        },{once:true});
      });
    });
    await vi.advanceTimersByTimeAsync(59_999);
    expect(sourceSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ok:false,code:"AI_MODEL_TIMEOUT"});
  });
});
