import {describe,expect,it,vi} from "vitest";
import {readConfiguredAiRuntimeConfig} from "../../src/server/ai/runtime-config";
import {callAiModel,type AiModelHttpRequest} from "../../src/server/ai/model-transport";
import {createFetchAiModelTransport} from "../../src/server/ai/fetch-transport";

const origin="https://codex-api.ezcomo.shop";
const output={output:{},replyDraft:"ServiceDesk model probe acknowledged",
  requestedToolCalls:[],citations:[]};
const gatewayReply=(payload:unknown=output,overrides:Record<string,unknown>={})=>JSON.stringify({
  id:"chatcmpl-synthetic",object:"chat.completion",created:1,model:"codex",
  choices:[{index:0,message:{role:"assistant",content:JSON.stringify(payload)},
    finish_reason:"stop"}],...overrides,
});
const input={
  workspaceId:"11111111-1111-4111-8111-111111111111",conversationId:"synthetic-connection-probe",
  promptVersion:"v4-r23-codex",userText:"Reply with a verified JSON checklist.",
};
const env={
  SERVICEDESK_AI_ENABLED:"true",SERVICEDESK_AI_PROVIDER:"codex_gateway",
  SERVICEDESK_CODEX_GATEWAY_ENABLED:"true",
  SERVICEDESK_CODEX_GATEWAY_KEY:"fictional-key-never-sent",
  SERVICEDESK_AI_MODEL:"codex",
  SERVICEDESK_CODEX_GATEWAY_TEST_WORKSPACE_ID:"11111111-1111-4111-8111-111111111111",
};

describe("R23 operator-controlled Codex Gateway configuration",()=>{
  it("defaults disabled; neither Codex login nor gateway key opts business data into model calls",()=>{
    expect(readConfiguredAiRuntimeConfig({...env,SERVICEDESK_AI_ENABLED:"false"}))
      .toMatchObject({ok:false,code:"AI_RUNTIME_DISABLED"});
    expect(readConfiguredAiRuntimeConfig({...env,SERVICEDESK_CODEX_GATEWAY_ENABLED:"false"}))
      .toMatchObject({ok:false,code:"AI_RUNTIME_GATEWAY_DISABLED"});
    expect(readConfiguredAiRuntimeConfig({...env,SERVICEDESK_CODEX_GATEWAY_KEY:undefined}))
      .toMatchObject({ok:false,code:"AI_RUNTIME_CONFIGURATION_INCOMPLETE"});
    expect(readConfiguredAiRuntimeConfig({...env,SERVICEDESK_AI_PROVIDER:"typo"}))
      .toMatchObject({ok:false,code:"AI_RUNTIME_PROVIDER_INVALID"});
    expect(readConfiguredAiRuntimeConfig({...env,SERVICEDESK_AI_MODEL:"unknown-model"}))
      .toMatchObject({ok:false,code:"AI_RUNTIME_MODEL_INVALID"});
    expect(readConfiguredAiRuntimeConfig({...env,SERVICEDESK_CODEX_GATEWAY_TEST_WORKSPACE_ID:undefined}))
      .toMatchObject({ok:false,code:"AI_RUNTIME_GATEWAY_WORKSPACE_REQUIRED"});
  });

  it("requires exactly the user-authorized HTTPS host without query, userinfo, ports or downgrade",()=>{
    const valid=readConfiguredAiRuntimeConfig(env);
    expect(valid).toMatchObject({ok:true,value:{
      apiBaseUrl:origin+"/v1",approvedGatewayOrigin:origin,
      provider:"codex_gateway",model:"codex",
      gatewayAllowedWorkspaceId:input.workspaceId,
      apiKey:env.SERVICEDESK_CODEX_GATEWAY_KEY,
    }});
    for(const bad of [
      "http://codex-api.ezcomo.shop/v1",
      "https://codex-api.ezcomo.shop.attacker.invalid/v1",
      "https://evil:password@codex-api.ezcomo.shop/v1",
      "https://codex-api.ezcomo.shop:444/v1",
      "https://codex-api.ezcomo.shop/v1?token=secret",
      "https://codex-api.ezcomo.shop/v1/other",
      "http://127.0.0.1:8765/v1",
    ]){
      expect(readConfiguredAiRuntimeConfig({...env,SERVICEDESK_AI_API_BASE_URL:bad}),
        bad).toMatchObject({ok:false,code:"AI_RUNTIME_ORIGIN_INVALID"});
    }
    expect(JSON.stringify(readConfiguredAiRuntimeConfig({...env,SERVICEDESK_AI_API_BASE_URL:"https://evil.invalid/v1"})))
      .not.toContain(env.SERVICEDESK_CODEX_GATEWAY_KEY);
  });

  it("preserves the default official Responses API when gateway is not selected",()=>{
    expect(readConfiguredAiRuntimeConfig({
      SERVICEDESK_AI_ENABLED:"true",OPENAI_API_KEY:"official-synthetic",
      SERVICEDESK_AI_MODEL:"gpt-6",
    })).toMatchObject({ok:true,value:{
      apiBaseUrl:"https://api.openai.com/v1",model:"gpt-6",
    }});
  });
});

describe("R23 bounded Chat Completions adapter with no new business-side effects",()=>{
  const config=readConfiguredAiRuntimeConfig(env);
  if(!config.ok) throw Error("mock gateway config rejected");
  const run=(body:string,status=200)=>callAiModel(config.value,input,
    async(request:AiModelHttpRequest)=>{
      expect(request.method).toBe("POST");
      return {status,body};
    });

  it("translates the existing guarded AI prompt to Codex and parses valid structured output",async()=>{
    const port=vi.fn(async(request:AiModelHttpRequest)=>{
      expect(request.url).toBe(origin+"/v1/chat/completions");
      expect(request.headers.authorization).toBe("Bearer fictional-key-never-sent");
      const data=JSON.parse(request.body);
      expect(data).toMatchObject({
        model:"codex",stream:false,reasoning_effort:"low",workspace:"servicedesk-ai",
      });
      expect(data.messages).toHaveLength(2);
      expect(data.messages[0].role).toBe("system");
      expect(data.messages[1].content).toBe(input.userText);
      expect(request.body).not.toContain(input.workspaceId);
      expect(request.body).not.toContain("synthetic-connection-probe");
      return {status:200,body:gatewayReply()};
    });
    expect(await callAiModel(config.value,input,port)).toMatchObject({
      ok:true,value:output,
    });
    expect(port).toHaveBeenCalledOnce();
  });

  it("rejects missing/multiple choices, hallucinated actions, incomplete and malformed response",async()=>{
    const samples=[
      JSON.stringify({object:"chat.completion",choices:[]}),
      gatewayReply(output,{choices:[
        {index:0,message:{role:"assistant",content:JSON.stringify(output)},finish_reason:"stop"},
        {index:1,message:{role:"assistant",content:JSON.stringify(output)},finish_reason:"stop"},
      ]}),
      gatewayReply(output,{choices:[
        {index:0,message:{role:"assistant",content:JSON.stringify(output),
          tool_calls:[{id:"tool-risk"}]},finish_reason:"stop"},
      ]}),
      gatewayReply(output,{choices:[
        {index:0,message:{role:"assistant",content:JSON.stringify(output)},finish_reason:"length"},
      ]}),
      gatewayReply(output,{choices:[
        {index:0,message:{role:"assistant",content:"not JSON"},finish_reason:"stop"},
      ]}),
      gatewayReply(output,{choices:[
        {index:0,message:{role:"assistant",content:"{}"},finish_reason:"stop"},
      ]}),
      gatewayReply(output,{choices:[
        {index:0,message:{role:"assistant",content:JSON.stringify({
          ...output,requestedToolCalls:"SEND_CUSTOMER_MESSAGE",
        })},finish_reason:"stop"},
      ]}),
    ];
    for(const body of samples){
      expect(await run(body),body.slice(0,90))
        .toMatchObject({ok:false,code:"AI_MODEL_INVALID_RESPONSE"});
    }
  });

  it("never attempts dispatch on denied configuration, spoofed gateway or abort",async()=>{
    const called=vi.fn(async()=>({status:200,body:gatewayReply()}));
    for(const bad of [
      {...config.value,apiBaseUrl:"https://attacker.invalid/v1"},
      {...config.value,approvedGatewayOrigin:"https://attacker.invalid"},
      {...config.value,apiBaseUrl:"https://codex-api.ezcomo.shop:443/v1"},
    ]){
      expect(await callAiModel(bad,input,called))
        .toMatchObject({ok:false,code:"AI_MODEL_CONFIGURATION_BLOCKED"});
    }
    const signal=new AbortController();signal.abort();
    expect(await callAiModel(config.value,{...input,signal:signal.signal},called))
      .toMatchObject({ok:false,code:"AI_MODEL_CANCELLED"});
    expect(await callAiModel(config.value,{...input,workspaceId:"22222222-2222-4222-8222-222222222222"},called))
      .toMatchObject({ok:false,code:"AI_MODEL_WORKSPACE_BLOCKED"});
    expect(called).not.toHaveBeenCalled();
  });

  it("normalizes 401 and throttling without provider body/credentials leaking",async()=>{
    expect(await run("PRIVATE_API_KEY",401))
      .toMatchObject({ok:false,code:"AI_MODEL_CONFIGURATION_BLOCKED"});
    const rate=await run("PRIVATE_API_KEY",429);
    expect(rate).toMatchObject({ok:false,code:"AI_MODEL_RATE_LIMITED"});
    expect(JSON.stringify(rate)).not.toContain("PRIVATE_API_KEY");
  });

  it("fetch sends only to exact HTTPS Codex path with no redirects",async()=>{
    const fetchPort=vi.fn(async(url:string,init:RequestInit)=>{
      expect(url).toBe(origin+"/v1/chat/completions");
      expect(init.redirect).toBe("error");
      expect(init.cache).toBe("no-store");
      return new Response(gatewayReply(),{status:200});
    });
    const result=await callAiModel(config.value,input,createFetchAiModelTransport(fetchPort));
    expect(result.ok).toBe(true);
    expect(fetchPort).toHaveBeenCalledOnce();
    let unwanted=0;
    for(const bad of [
      "http://codex-api.ezcomo.shop/v1/chat/completions",
      "https://codex-api.ezcomo.shop/v1/responses",
      "https://codex-api.ezcomo.shop/v1/chat/completions?redirect=https://evil.invalid",
      "https://codex-api.ezcomo.shop.evil.invalid/v1/chat/completions",
      "https://api.openai.com/v1/chat/completions",
    ]){
      const adapter=createFetchAiModelTransport(async()=>{
        unwanted++;return new Response(gatewayReply());
      });
      await expect(adapter({
        url:bad,method:"POST",body:"{}",headers:{authorization:"Bearer synthetic"},
        signal:new AbortController().signal,
      })).rejects.toThrow("AI_MODEL_HTTP_URL_INVALID");
    }
    expect(unwanted).toBe(0);
  });
});
