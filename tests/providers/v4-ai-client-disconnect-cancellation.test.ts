import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  callAiModel,
  type AiModelHttpRequest,
  type AiModelHttpResponse,
} from "../../src/server/ai/model-transport";
import { createFetchAiModelTransport } from "../../src/server/ai/fetch-transport";

const config = {
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "ci-only-not-a-real-provider-key",
  model: "ci-only-model",
  timeoutMs: 10_000,
  now: () => "2026-10-13T00:00:00.000Z",
};
const input = {
  promptVersion: "ci-request-brief",
  conversationId: "req-ci-1",
  workspaceId: "tenant-ci-1",
  userText: "Saved non-customer request facts only",
  approvedKnowledgeRefs: [] as string[],
};

describe("V4 staff cancellation stops obsolete model inference", () => {
  it("does not call the provider when the HTTP client already disconnected", async () => {
    const ctl = new AbortController();
    ctl.abort();
    const http = vi.fn(async () => ({status:200,body:'{"output":{}}'}));
    const result = await callAiModel(config, {...input,signal:ctl.signal},http);
    expect(result).toMatchObject({ok:false,code:"AI_MODEL_CANCELLED"});
    expect(http).not.toHaveBeenCalled();
  });

  it("forwards in-flight cancellation to the underlying provider fetch signal", async () => {
    const ctl = new AbortController();
    let transportSignal: AbortSignal | undefined;
    const http = vi.fn((request: AiModelHttpRequest) => {
      transportSignal = request.signal;
      return new Promise<AiModelHttpResponse>((_resolve,reject) => {
        const rejectAbort=()=>{
          const error = new Error("client-disconnected");
          error.name="AbortError";
          reject(error);
        };
        if (request.signal.aborted) rejectAbort();
        else request.signal.addEventListener("abort",rejectAbort,{once:true});
      });
    });
    const pending=callAiModel(config,{...input,signal:ctl.signal},http);
    expect(http).toHaveBeenCalledTimes(1);
    expect(transportSignal?.aborted).toBe(false);
    ctl.abort();
    const result=await pending;
    expect(transportSignal?.aborted).toBe(true);
    expect(result).toMatchObject({ok:false,code:"AI_MODEL_CANCELLED"});
  });

  it("discards a late success from any provider adapter that ignores cancellation", async () => {
    const ctl = new AbortController();
    const deferred: { resolve?: (value: AiModelHttpResponse) => void } = {};
    const http = (_request: AiModelHttpRequest) =>
      new Promise<AiModelHttpResponse>(resolve => {deferred.resolve=resolve;});
    const pending=callAiModel(config,{...input,signal:ctl.signal},http);
    expect(deferred.resolve).toBeTypeOf("function");
    ctl.abort();
    deferred.resolve?.({status:200,body:'{"output":{}}'});
    expect(await pending).toMatchObject({ok:false,code:"AI_MODEL_CANCELLED"});
  });

  it("preserves normal authorized model results and separate timeout behavior", async () => {
    const ok = await callAiModel(config,input,async () =>
      ({status:200,body:'{"output":{}}'}));
    expect(ok.ok).toBe(true);
    const failure = await callAiModel(config,input,async () =>
      ({status:503,body:""}));
    expect(failure).toMatchObject({ok:false,code:"AI_MODEL_TRANSIENT_FAILURE"});
  });

  it("threads only server request.signal into inference; never accepts a browser-authored signal field",()=>{
    const read=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
    const handler=read("src/server/api-handlers/ai-request-brief-http.ts");
    const brief=read("src/server/ai/request-brief.ts");
    const model=read("src/server/ai/model-transport.ts");
    const route=read("src/app/api/internal/ai/request-brief/route.ts");
    expect(handler).toContain("generateAuthorizedRequestBrief(input, { signal: request.signal })");
    expect(handler).toContain('!["workspaceSlug", "requestId"].includes(k)');
    expect(brief).toContain("deps.signal?.aborted");
    expect(brief).toContain("...(deps.signal ? { signal: deps.signal } : {})");
    expect(model).toContain('input.signal?.addEventListener("abort", cancelFromCaller');
    expect(model).toContain('input.signal?.removeEventListener("abort", cancelFromCaller)');
    expect(route).toContain("handleRequestBriefPost");
    expect(createFetchAiModelTransport).toBeTypeOf("function");
  });
});
