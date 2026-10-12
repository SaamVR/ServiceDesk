import { describe, expect, it, vi } from "vitest";
import { handleRequestBriefPost } from "../../src/server/api-handlers/ai-request-brief-http";
import { handleAiOwnerProbePost } from "../../src/server/api-handlers/ai-owner-probe-http";

const slug="fictional-guest-no-session";
const requestId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const endpoints=[
  {
    label:"request-brief",
    path:"/api/internal/ai/request-brief",
    body:{workspaceSlug:slug,requestId},
    unauthorized:"AI_BRIEF_AUTH_REQUIRED",
    call:async(req:Request,call:()=>void)=>{
      return handleRequestBriefPost(req,async()=>{
        call();return {ok:false,code:"AI_BRIEF_AUTH_REQUIRED",message:"synthetic"};
      });
    },
  },
  {
    label:"connection-test",
    path:"/api/internal/ai/connection-test",
    body:{workspaceSlug:slug},
    unauthorized:"AI_DIAGNOSTIC_AUTH_REQUIRED",
    call:async(req:Request,call:()=>void)=>{
      return handleAiOwnerProbePost(req,async()=>{
        call();return {ok:false,code:"AI_DIAGNOSTIC_AUTH_REQUIRED",message:"synthetic"};
      });
    },
  },
];
type Handler = typeof endpoints[number];
function request(endpoint:Handler,options:{
  reqOrigin?:string;
  browserOrigin?:string;
  host?:string;
  fetchSite?:string;
  extras?:Record<string,unknown>;
  forwardedHost?:string;
}={}) {
  return new Request(
    (options.reqOrigin??"http://localhost:3000")+endpoint.path,{
      method:"POST",
      headers:{
        "content-type":"application/json",
        Origin:options.browserOrigin??"http://127.0.0.1:3000",
        Host:options.host??"127.0.0.1:3000",
        "sec-fetch-site":options.fetchSite??"same-origin",
        ...(options.forwardedHost?{"x-forwarded-host":options.forwardedHost}:{}),
      },
      body:JSON.stringify({...endpoint.body,...options.extras}),
    },
  );
}
describe.each(endpoints)("V4 protected $label built-Next loopback origin",endpoint=>{
  it("validates a browser's actual Host and Origin then denies unsigned-in staff",async()=>{
    const called=vi.fn();
    const response=await endpoint.call(request(endpoint),called);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({code:endpoint.unauthorized});
    expect(called).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects forged owner body before a session or provider call",async()=>{
    const called=vi.fn();
    const response=await endpoint.call(request(endpoint,{extras:{role:"OWNER"}}),called);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({code:"REQUEST_SCHEMA_INVALID"});
    expect(called).not.toHaveBeenCalled();
  });
  it.each([
    {browserOrigin:"https://evil.example",host:"evil.example"},
    {browserOrigin:"http://127.0.0.1:3001",host:"127.0.0.1:3001"},
    {reqOrigin:"http://localhost:8443"},
    {host:"attacker.example"},
    {fetchSite:"cross-site"},
    {forwardedHost:"attacker.example",host:"attacker.example"},
    {browserOrigin:"https://127.0.0.1:3000",host:"127.0.0.1:3000"},
  ])("rejects spoofed host, off-port and cross-site contexts %j",async opt=>{
    const called=vi.fn();
    const response=await endpoint.call(request(endpoint,opt),called);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({code:"SAME_ORIGIN_REQUIRED"});
    expect(called).not.toHaveBeenCalled();
  });
  it("retains an explicitly configured HTTPS origin behind a private proxy",async()=>{
    vi.stubEnv("SERVICEDESK_AI_ALLOWED_ORIGIN","https://desk.example.com");
    try{
      const called=vi.fn();
      const response=await endpoint.call(request(endpoint,{
        reqOrigin:"http://private-node:3000",
        browserOrigin:"https://desk.example.com",
        host:"private-node:3000",
      }),called);
      expect(response.status).toBe(401);
      expect(called).toHaveBeenCalledOnce();
    }finally{
      vi.unstubAllEnvs();
    }
  });
});
