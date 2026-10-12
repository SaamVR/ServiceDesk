import { describe, expect, it, vi } from "vitest";
import type { OutboxJob } from "../../src/server/integrations/types";
import { WebhookCommittedOutboxDispatcher } from
  "../../src/server/integrations/outbox/webhook-dispatcher";

const workspace="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreign="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const job:OutboxJob={
  id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  workspaceId:workspace,channel:"WEBHOOK",purpose:"STAFF_ALERT",
  recipient:{recipientRef:"internal",consentRequired:false,hasOptIn:true,optedOut:false},
  createdAt:"2026-10-13T00:00:00Z",idempotencyKey:"internal:qa-event",
  payload:{event:"FICTIONAL_ONLY"},
};

function fixture(options:{url?:string;headers?:Record<string,string>}={}){
  const resolve=vi.fn(async()=>({ok:true as const,value:{
    endpointId:"configured",url:options.url??"https://flows.example.com/event",
    method:"POST" as const,body:{event:"FICTIONAL_ONLY"},headers:options.headers??{},
  }}));
  const transport=vi.fn(async()=>({
    status:202,providerMessageId:"synthetic-accepted",
    acceptedAt:"2026-10-13T00:00:00Z",
  }));
  const dispatcher=new WebhookCommittedOutboxDispatcher({resolve},transport);
  const dispatch=(expectedWorkspaceId=workspace)=>
    dispatcher.dispatch({job,expectedWorkspaceId,expectedChannel:"WEBHOOK",
      committedAt:"2026-10-13T00:00:00Z",attempt:1});
  return {resolve,transport,dispatch};
}

describe("final committed webhook dispatch admission",()=>{
  it("allows a same-tenant approved resolver without invoking an external provider",async()=>{
    const h=fixture();
    expect(await h.dispatch()).toMatchObject({
      ok:true,value:{outcome:"ACCEPTED",workspaceId:workspace,channel:"WEBHOOK"},
    });
    expect(h.transport).toHaveBeenCalledOnce();
  });
  it("rejects foreign-workspace jobs before resolving or sending any webhook",async()=>{
    const h=fixture();
    expect(await h.dispatch(foreign)).toMatchObject({
      ok:true,value:{outcome:"TERMINAL_FAILURE",code:"WORKSPACE_MISMATCH"},
    });
    expect(h.resolve).not.toHaveBeenCalled();
    expect(h.transport).not.toHaveBeenCalled();
  });
  it.each([
    "http://flows.example.com/event",
    "https://alice:secret@flows.example.com/event",
    "https://flows.example.com:8443/event",
    "https://flows.example.com/event#fragment",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/event",
    "https://internal.local/event",
    " https://flows.example.com/event",
  ])("blocks an unsafe final URL before transport: %s",async url=>{
    const h=fixture({url});
    expect(await h.dispatch()).toMatchObject({
      ok:true,value:{outcome:"TERMINAL_FAILURE",code:"WEBHOOK_CONFIG_INVALID"},
    });
    expect(h.transport).not.toHaveBeenCalled();
  });
  it.each([
    {host:"flows.attacker.example"},
    {connection:"keep-alive"},
    {"proxy-authorization":"Bearer redacted-synthetic"},
    {"content-length":"12345"},
    {"x-injected":"legit\r\nHost: internal"},
  ])("blocks hop-by-hop and injected headers: %j",async headers=>{
    const h=fixture({headers:headers as unknown as Record<string,string>});
    expect(await h.dispatch()).toMatchObject({
      ok:true,value:{outcome:"TERMINAL_FAILURE",code:"WEBHOOK_CONFIG_INVALID"},
    });
    expect(h.transport).not.toHaveBeenCalled();
    expect(JSON.stringify(await h.dispatch())).not.toContain("redacted-synthetic");
  });
  it("permits configured application authorization without exposing it in outcome",async()=>{
    const h=fixture({headers:{authorization:"Bearer synthetic-only"}});
    const result=await h.dispatch();
    expect(result).toMatchObject({ok:true,value:{outcome:"ACCEPTED"}});
    expect(h.transport).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toContain("synthetic-only");
  });
});
