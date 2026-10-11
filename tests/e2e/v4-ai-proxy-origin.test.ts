import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRequestBriefPost } from "../../src/server/api-handlers/ai-request-brief-http";

const api="http://127.0.0.1:10000/api/internal/ai/request-brief";
const publicOrigin="https://servicedesk-v3-frontend-review.onrender.com";
const goodBody=JSON.stringify({
  workspaceSlug:"fictional-cleaning",
  requestId:"00000000-0000-4000-8000-000000000001",
});
function make(origin?:string,fetchSite?:string,extra:Record<string,string>={}) {
  return new Request(api,{
    method:"POST",
    headers:{"content-type":"application/json",...(origin?{origin}:{}),
      ...(fetchSite?{"sec-fetch-site":fetchSite}:{}),...extra},
    body:goodBody,
  });
}
const denied=vi.fn(async()=>({ok:false as const,code:"AI_BRIEF_AUTH_REQUIRED",message:"login required"}));
afterEach(()=>{vi.unstubAllEnvs();denied.mockClear()});

describe("V4 AI brief CSRF protection behind an ingress proxy",()=>{
  it("recognizes the exact trusted HTTPS Render origin despite an internal Next request.url",async()=>{
    vi.stubEnv("SERVICEDESK_AI_ALLOWED_ORIGIN",publicOrigin);
    const response=await handleRequestBriefPost(make(publicOrigin,"same-origin"),denied);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({code:"AI_BRIEF_AUTH_REQUIRED"});
    expect(denied).toHaveBeenCalledOnce();
  });
  it("also permits same-origin loopback QA without assuming a public trusted origin",async()=>{
    const response=await handleRequestBriefPost(make("http://127.0.0.1:10000","same-origin"),denied);
    expect(response.status).toBe(401);
    expect(denied).toHaveBeenCalledOnce();
  });
  it("rejects a forged forwarded host and external Origin even when origin is pinned",async()=>{
    vi.stubEnv("SERVICEDESK_AI_ALLOWED_ORIGIN",publicOrigin);
    const response=await handleRequestBriefPost(make("https://evil.example","cross-site",{
      "x-forwarded-host":"servicedesk-v3-frontend-review.onrender.com",
      "x-forwarded-proto":"https",
    }),denied);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({code:"SAME_ORIGIN_REQUIRED"});
    expect(denied).not.toHaveBeenCalled();
  });
  it("rejects cross-site fetch metadata, even when the string origin equals the configured host",async()=>{
    vi.stubEnv("SERVICEDESK_AI_ALLOWED_ORIGIN",publicOrigin);
    const response=await handleRequestBriefPost(make(publicOrigin,"cross-site"),denied);
    expect(response.status).toBe(403);
    expect(denied).not.toHaveBeenCalled();
  });
  it("fails closed if the trusted public origin is insecure or contains credentials or a path",async()=>{
    for(const invalid of [
      "http://servicedesk-v3-frontend-review.onrender.com",
      "https://evil.example/path",
      "https://user:pass@evil.example",
      "https://evil.example:444/",
    ]) {
      vi.stubEnv("SERVICEDESK_AI_ALLOWED_ORIGIN",invalid);
      const response=await handleRequestBriefPost(make(publicOrigin),denied);
      expect(response.status,invalid).toBe(403);
    }
    expect(denied).not.toHaveBeenCalled();
  });
  it("requires an Origin header even if Host or forwarded headers appear trustworthy",async()=>{
    vi.stubEnv("SERVICEDESK_AI_ALLOWED_ORIGIN",publicOrigin);
    const response=await handleRequestBriefPost(make(undefined,undefined,{"x-forwarded-host":"servicedesk-v3-frontend-review.onrender.com"}),denied);
    expect(response.status).toBe(403);
    expect(denied).not.toHaveBeenCalled();
  });
});
