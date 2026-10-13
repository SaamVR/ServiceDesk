import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InternalSourceRecoverySummary, InternalSourceWorkerPorts,
  InternalSourceWorkerDependencies,
} from "../../src/server/workflows/customer-quote-source-recovery";
import {
  handleInternalQuoteSourceWorkerPost,
  type QuoteSourceWorkerHttpDependencies,
} from "../../src/server/workflows/customer-quote-source-worker-http";

const secret = "strictly-temporary-private-quote-worker-key-that-is-forty-characters";
const settings = {
  workerEnabled: true,
  automationEnabled: true,
  secret,
  databaseMode: "SERVICE_ROLE",
  supabaseUrl: "https://qa-project.supabase.co",
  serviceRoleKey: "local-testing-only-service-role-key-without-provider-access",
};
const sample = {
  state: "BATCH_PROCESSED" as const,
  claimed: 2, completed: 1, retryPending: 1, skipped: 0,
  deadLetter: 0, completionNotVerified: 0, providerMessagesSent: 0 as const,
};

function harness(overrides: Partial<typeof settings> = {},
  outcome: InternalSourceRecoverySummary = sample) {
  const createService = vi.fn(() => ({} as SupabaseClient));
  const runBatch = vi.fn(async(_ports: InternalSourceWorkerPorts,
    _deps?: InternalSourceWorkerDependencies) => outcome);
  const deps = {
    settings: () => ({ ...settings, ...overrides }),
    createService,
    runBatch,
    workerId: () => "recovery_qa_001",
  } as unknown as QuoteSourceWorkerHttpDependencies;
  return { deps, createService, runBatch };
}
function req(token?: string, method = "POST", body?: unknown) {
  return new Request("https://local.example/api/internal/workflows/quote-source",{
    method, headers: {
      ...(token ? { authorization: "Bearer " + token } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("V4 private quote-source replay entrypoint", () => {
  it("is completely unavailable unless BOTH server-level switches and SERVICE_ROLE mode permit it",async()=>{
    for(const override of [
      {workerEnabled:false}, {automationEnabled:false},
      {databaseMode:"QA_SESSION_RLS"}, {databaseMode:"DISABLED"},
      {secret:undefined},
    ]) {
      const h=harness(override);
      const res=await handleInternalQuoteSourceWorkerPost(req(secret),h.deps);
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ok:false,code:"NOT_CONFIGURED"});
      expect(h.runBatch).not.toHaveBeenCalled();
      expect(h.createService).not.toHaveBeenCalled();
    }
  });

  it("denies all missing, short or incorrect server tokens before creating privileged client",async()=>{
    for(const attempt of [undefined,"short","a".repeat(50)]) {
      const h=harness();
      const res=await handleInternalQuoteSourceWorkerPost(req(attempt),h.deps);
      expect(res.status).toBe(401);
      expect(h.createService).not.toHaveBeenCalled();
      expect(h.runBatch).not.toHaveBeenCalled();
    }
  });

  it("rejects GET without revealing whether the protected worker is enabled",async()=>{
    const h=harness();
    const res=await handleInternalQuoteSourceWorkerPost(req(secret,"GET"),h.deps);
    expect(res.status).toBe(405);
    expect(h.runBatch).not.toHaveBeenCalled();
  });

  it("fails closed if secrets/service-role backend are missing even after correct authentication",async()=>{
    const h=harness({serviceRoleKey:""});
    const res=await handleInternalQuoteSourceWorkerPost(req(secret),h.deps);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ok:false,code:"BACKEND_UNAVAILABLE"});
    expect(h.runBatch).not.toHaveBeenCalled();
  });

  it("replays only a fixed bounded server-owned batch, never caller-supplied tenant or provider action",async()=>{
    const h=harness();
    const res=await handleInternalQuoteSourceWorkerPost(req(secret,"POST",{
      workspaceId:"other-tenant",maxBatch:10000,
      email:"unapproved@example.com",sendWhatsApp:true,workerId:"attacker",
    }),h.deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ok:true,claimed:2,completed:1,retried:1,
      allEventsCompleted:false,providerMessagesSent:0});
    expect(h.runBatch).toHaveBeenCalledTimes(1);
    const payload=h.runBatch.mock.calls[0][0] as {workerId:string;maxBatch:number};
    expect(payload.workerId).toBe("recovery_qa_001");
    expect(payload.maxBatch).toBe(10);
    expect(JSON.stringify(payload)).not.toContain("other-tenant");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("returns 503 when any batch completion cannot be verified or claim is unavailable",async()=>{
    for(const outcome of [
      {...sample,completionNotVerified:1},
      {...sample,state:"CLAIM_UNVERIFIED" as const},
    ]) {
      const h=harness({},outcome);
      const res=await handleInternalQuoteSourceWorkerPost(req(secret),h.deps);
      expect(res.status).toBe(503);
    }
  });

  it("reports full internal completion distinctly from accepted retry/dead-letter batches",async()=>{
    const success = harness({}, {...sample,claimed:1,completed:1,retryPending:0});
    const ok = await handleInternalQuoteSourceWorkerPost(req(secret),success.deps);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ok:true,allEventsCompleted:true,
      completed:1,providerMessagesSent:0});

    const terminal = harness({}, {...sample,claimed:1,completed:0,
      retryPending:0,deadLetter:1});
    const failed = await handleInternalQuoteSourceWorkerPost(req(secret),terminal.deps);
    expect(failed.status).toBe(200);
    expect(await failed.json()).toMatchObject({ok:true,
      allEventsCompleted:false,deadLetter:1,providerMessagesSent:0});
  });

  it("fails closed without disclosing malformed settings reader exceptions",async()=>{
    const h=harness();
    const deps={...h.deps,settings:()=>{ throw new Error(
      "secret leak should never render: "+secret); }};
    const res=await handleInternalQuoteSourceWorkerPost(req(secret),deps);
    expect(res.status).toBe(503);
    const body=await res.text();
    expect(body).toContain("BACKEND_UNAVAILABLE");
    expect(body).not.toContain(secret);
    expect(h.createService).not.toHaveBeenCalled();
    expect(h.runBatch).not.toHaveBeenCalled();
  });

  it("never exposes secrets or a database exception on worker failure",async()=>{
    const h=harness();
    h.runBatch.mockRejectedValue(new Error(
      "database-failed with customer PII " + secret));
    const res=await handleInternalQuoteSourceWorkerPost(req(secret),h.deps);
    const body=await res.text();
    expect(res.status).toBe(503);
    expect(body).toContain("RECOVERY_UNAVAILABLE");
    expect(body).not.toContain("customer PII");
    expect(body).not.toContain(secret);
  });

  it("has no automatic GET, scheduler, provider sends or deployed activation",()=>{
    const read=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
    const route=read("src/app/api/internal/workflows/quote-source/route.ts");
    const source=read("src/server/workflows/customer-quote-source-worker-http.ts");
    expect(route).toContain('runtime = "nodejs"');
    expect(route).toContain("export async function POST");
    expect(route).not.toContain("export async function GET");
    expect(source).toContain('SERVICEDESK_QUOTE_SOURCE_WORKER_ENABLED === "true"');
    expect(source).toContain('SERVICEDESK_AUTO_INTERNAL_QUOTE_ACCEPTED === "true"');
    expect(source).toContain("timingSafeEqual");
    expect(source).toContain("maxBatch: 10");
    expect(source).not.toContain("SEND_WHATSAPP_TEMPLATE");
    expect(source).not.toContain("SEND_EMAIL_TEMPLATE");
  });
});
