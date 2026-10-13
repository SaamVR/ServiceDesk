import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  generateAuthorizedRequestBrief, type RequestBriefDependencies,
} from "../../src/server/ai/request-brief";
import { handleRequestBriefPost } from "../../src/server/api-handlers/ai-request-brief-http";

const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const branchId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherBranchId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const requestId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const serviceId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const input = { workspaceSlug: "fictional-cleaning", requestId };

function harness(options: {
  role?: string;
  branch?: string;
  disabled?: boolean;
  absent?: boolean;
  modelTools?: boolean;
  modelDraft?: string;
  noService?: boolean;
  missingCatalog?: boolean;
  catalogError?: boolean;
  invalidServiceId?: boolean;
  dispatcherUnscoped?: boolean;
  wrongWorkspace?: boolean;
  wrongRequestId?: boolean;
  requestReadThrows?: boolean;
  catalogReadThrows?: boolean;
  modelThrows?: boolean;
  modelFailureCode?: string;
} = {}) {
  const filters: Array<[string, unknown]> = [];
  const selects: Array<[string, string]> = [];
  const service = {
    from(table: string) {
      expect(["requests", "service_catalog"]).toContain(table);
      const query = {
        select(columns: string) {
          selects.push([table, columns]);
          if (table === "requests") {
            expect(columns).toContain("service_id");
            expect(columns).not.toContain("service_code");
          }
          return query;
        },
        eq(key: string, value: unknown) { filters.push([key, value]); return query; },
        async maybeSingle() {
          if (options.requestReadThrows && table === "requests") throw Error("private database detail");
          if (options.catalogReadThrows && table === "service_catalog") throw Error("private catalog detail");
          if (table === "service_catalog") {
            return {
              error: options.catalogError ? { code: "DB_UNAVAILABLE", message: "private" } : null,
              data: options.missingCatalog ? null : {
                id: serviceId,
                workspace_id: workspaceId,
                code: "MOVE_OUT",
                name: "Never share freeform customer text",
              },
            };
          }
          return {
            error: null,
            data: options.absent ? null : {
              id: options.wrongRequestId ? "ffffffff-ffff-4fff-8fff-ffffffffffff" : requestId,
              workspace_id: options.wrongWorkspace ? otherBranchId : workspaceId,
              branch_id: options.branch ?? branchId,
              service_id: options.noService ? null : options.invalidServiceId ? "bad-service-id" : serviceId,
              bedrooms: 3,
              bathrooms: 2,
              status: "NEW",
              customer_email: "private@example.com",
              address_line1: "never send to model",
            },
          };
        },
      };
      return query;
    },
  };
  const model = vi.fn(async (_config: unknown, prompt: { userText: string; workspaceId: string }) => {
    if (options.modelThrows) throw Error("private model secret and request body");
    if (options.modelFailureCode) return {
      ok: false as const,
      code: options.modelFailureCode,
      message: "secret provider payload: customer@example.invalid, sk-private-token",
    };
    expect(prompt.workspaceId).toBe(workspaceId);
    expect(prompt.userText).not.toContain("private@example.com");
    expect(prompt.userText).not.toContain("never send to model");
    expect(prompt.userText).toContain(options.noService
      ? '"serviceCode":"not recorded"'
      : '"serviceCode":"MOVE_OUT"');
    expect(prompt.userText).not.toContain("Never share freeform customer text");
    return { ok: true as const, value: {
      output: {},
      replyDraft: options.modelDraft ?? "Saved move-out enquiry: three bedrooms, two bathrooms. Confirm the cleaning scope and preferred timing with staff.",
      requestedToolCalls: options.modelTools ? [{ name: "sendEmail" }] : [],
    } };
  });
  const resolve = vi.fn(async () => ({
    ok: true, value: {
      workspace: { id: workspaceId, slug: input.workspaceSlug, timezone: "UTC", currency: "USD", name: "QA" },
      actor: { workspaceId, userId: "user_qa", role: options.role ?? "OWNER" },
      service,
      branchScope: options.dispatcherUnscoped
        ? { mode: "ALL", branches: [] }
        : { mode: "BRANCH", selectedBranchId: branchId, branches: [] },
    },
  }));
  const config = vi.fn(() => options.disabled
    ? { ok: false, code: "AI_RUNTIME_DISABLED", message: "disabled" }
    : { ok: true, value: { apiBaseUrl: "https://api.openai.com/v1", apiKey: "test-only", model: "gpt-test", now: () => "2026-10-12T00:00:00Z" } });
  const deps = {
    resolveActor: resolve,
    readConfig: config,
    callModel: model,
  } as unknown as RequestBriefDependencies;
  return { deps, model, resolve, config, filters, selects };
}

describe("V4 model-backed cleaning request copilot", () => {
  it("requires an authorized saved request and returns a staff-only, explicitly unapproved draft", async () => {
    const t = harness();
    const result = await generateAuthorizedRequestBrief(input, t.deps);
    expect(result).toMatchObject({ ok: true, value: {
      state: "AI_DRAFT_REQUIRES_REVIEW",
      requestId,
      source: "AUTHORIZED_SAVED_REQUEST",
      model: "gpt-test",
    } });
    expect(t.filters).toContainEqual(["id", requestId]);
    expect(t.filters).toContainEqual(["workspace_id", workspaceId]);
    expect(t.model).toHaveBeenCalledTimes(1);
  });

  it("resolves the persisted service foreign key from the same workspace-scoped catalog", async () => {
    const t = harness();
    expect(await generateAuthorizedRequestBrief(input, t.deps))
      .toMatchObject({ ok: true, value: { state: "AI_DRAFT_REQUIRES_REVIEW" } });
    expect(t.selects).toContainEqual(["service_catalog", "code"]);
    expect(t.filters).toContainEqual(["id", serviceId]);
    expect(t.filters).toContainEqual(["workspace_id", workspaceId]);
    expect(t.model).toHaveBeenCalledOnce();
  });

  it("allows a valid request without an assigned service, but never invents a service", async () => {
    const t = harness({ noService: true });
    expect(await generateAuthorizedRequestBrief(input, t.deps))
      .toMatchObject({ ok: true });
    expect(t.selects.some(([table]) => table === "service_catalog")).toBe(false);
    expect(t.model).toHaveBeenCalledOnce();
  });

  it("fails before the provider when the stored service reference is malformed or cannot be verified", async () => {
    for (const options of [
      { invalidServiceId: true },
      { missingCatalog: true },
      { catalogError: true },
    ]) {
      const t = harness(options);
      const outcome = await generateAuthorizedRequestBrief(input, t.deps);
      expect(outcome.ok).toBe(false);
      expect(t.model).not.toHaveBeenCalled();
    }
  });

  it("does not query the database or call the model if AI is disabled", async () => {
    const t = harness({ disabled: true });
    const result = await generateAuthorizedRequestBrief(input, t.deps);
    expect(result).toMatchObject({ ok: false, code: "AI_RUNTIME_DISABLED" });
    expect(t.filters).toHaveLength(0);
    expect(t.model).not.toHaveBeenCalled();
  });

  it("rejects a different branch for dispatchers before any model call", async () => {
    const t = harness({ role: "DISPATCHER", branch: otherBranchId });
    expect(await generateAuthorizedRequestBrief(input, t.deps))
      .toMatchObject({ ok: false, code: "AI_BRIEF_NOT_FOUND" });
    expect(t.model).not.toHaveBeenCalled();
  });

  it("fails closed for dispatcher legacy or ALL scope before database/model access", async () => {
    const t = harness({role:"DISPATCHER",dispatcherUnscoped:true});
    expect(await generateAuthorizedRequestBrief(input,t.deps))
      .toMatchObject({ok:false,code:"AI_BRIEF_FORBIDDEN"});
    expect(t.filters).toHaveLength(0);
    expect(t.model).not.toHaveBeenCalled();
  });

  it("rejects mismatched persisted request identifiers and tenant IDs even if database query misbehaves", async () => {
    for (const kind of [{wrongRequestId:true},{wrongWorkspace:true}]) {
      const t=harness(kind);
      expect(await generateAuthorizedRequestBrief(input,t.deps))
        .toMatchObject({ok:false,code:"AI_BRIEF_NOT_FOUND"});
      expect(t.model).not.toHaveBeenCalled();
    }
  });

  it("normalizes thrown database and provider exceptions without leaking private details", async () => {
    for (const [opts,code] of [
      [{requestReadThrows:true},"AI_BRIEF_READ_FAILED"],
      [{catalogReadThrows:true},"AI_BRIEF_SERVICE_READ_FAILED"],
      [{modelThrows:true},"AI_BRIEF_PROVIDER_UNAVAILABLE"],
    ] as const) {
      const t=harness(opts);
      const result=await generateAuthorizedRequestBrief(input,t.deps);
      expect(result).toMatchObject({ok:false,code});
      expect(JSON.stringify(result)).not.toMatch(/private database detail|private catalog detail|private model secret/);
    }
  });

  it("preserves only approved normalized model failure codes without exposing provider details", async () => {
    for (const code of [
      "AI_MODEL_RATE_LIMITED", "AI_MODEL_TIMEOUT",
      "AI_MODEL_TRANSIENT_FAILURE", "AI_MODEL_NETWORK_FAILURE",
      "AI_MODEL_CONFIGURATION_BLOCKED", "AI_MODEL_INVALID_RESPONSE",
    ]) {
      const t = harness({ modelFailureCode: code });
      const result = await generateAuthorizedRequestBrief(input, t.deps);
      expect(result).toMatchObject({ ok: false, code });
      expect(JSON.stringify(result)).not.toContain("customer@example.invalid");
      expect(JSON.stringify(result)).not.toContain("sk-private-token");
      expect(t.model).toHaveBeenCalledOnce();
    }
    const unknown = harness({ modelFailureCode: "PRIVATE_UPSTREAM_ERROR_secret_value" });
    const hidden = await generateAuthorizedRequestBrief(input, unknown.deps);
    expect(hidden).toMatchObject({ ok: false, code: "AI_BRIEF_PROVIDER_UNAVAILABLE" });
    expect(JSON.stringify(hidden)).not.toContain("PRIVATE_UPSTREAM_ERROR_secret_value");
    expect(JSON.stringify(hidden)).not.toContain("sk-private-token");
  });

  it("never generates from a nonexistent request or from a model tool command", async () => {
    const missing = harness({ absent: true });
    expect(await generateAuthorizedRequestBrief(input, missing.deps))
      .toMatchObject({ ok: false, code: "AI_BRIEF_NOT_FOUND" });
    expect(missing.model).not.toHaveBeenCalled();

    const tools = harness({ modelTools: true });
    expect(await generateAuthorizedRequestBrief(input, tools.deps))
      .toMatchObject({ ok: false, code: "AI_BRIEF_OUTPUT_UNSAFE" });
  });

  it("rejects ungrounded AI-generated contacts, charges, dates, links, and falsely completed actions", async () => {
    const dangerous = [
      "Send to client@example.org right now.",
      "See https://billing.example.org/checkout.",
      "The total is $340, payable now.",
      "Your booking is for 2026-11-10.",
      "Call (555) 123-4567 to confirm.",
      "We have charged the customer.",
      "<script>alert(1)</script>",
      "",
    ];
    for (const modelDraft of dangerous) {
      const t = harness({ modelDraft });
      const result = await generateAuthorizedRequestBrief(input, t.deps);
      expect(result, modelDraft).toMatchObject({ ok: false, code: "AI_BRIEF_OUTPUT_INVALID" });
      expect(t.model).toHaveBeenCalledOnce();
    }
  });

  it("preserves ordinary grounded and non-authoritative review advice", async () => {
    const t = harness({modelDraft: "  The saved MOVE_OUT enquiry shows 3 bedrooms and 2 bathrooms. Ask staff to confirm access instructions and preferred timing. "});
    const result = await generateAuthorizedRequestBrief(input, t.deps);
    expect(result).toMatchObject({ok:true,value:{state:"AI_DRAFT_REQUIRES_REVIEW"}});
    if(result.ok) expect(result.value.briefing).toMatch(/^The saved MOVE_OUT enquiry/);
  });

  it("rejects wrong-origin requests, malformed IDs and oversized payloads", async () => {
    const run = vi.fn(async () => ({ ok: false as const, code: "AI_BRIEF_NOT_FOUND", message: "not found" }));
    const make = (body: string, origin = "https://evil.example") => new Request("https://studio.example/api/internal/ai/request-brief", {
      method: "POST",
      headers: { origin, "content-type": "application/json", "sec-fetch-site": "same-origin" },
      body,
    });
    expect((await handleRequestBriefPost(make(JSON.stringify(input)), run)).status).toBe(403);
    expect((await handleRequestBriefPost(make(JSON.stringify({ ...input, requestId: "/other" }), "https://studio.example"), run)).status).toBe(400);
    expect((await handleRequestBriefPost(make("x".repeat(2200), "https://studio.example"), run)).status).toBe(413);
    expect(run).not.toHaveBeenCalled();
  });

  it("never exports provider receipts or executes a proposed action through the HTTP endpoint", async () => {
    const run = vi.fn(async () => ({ ok: true as const, value: {
      state: "AI_DRAFT_REQUIRES_REVIEW" as const, requestId, source: "AUTHORIZED_SAVED_REQUEST" as const,
      model: "gpt-test", briefing: "Review the missing information.",
    } }));
    const response = await handleRequestBriefPost(new Request("https://studio.example/api/internal/ai/request-brief", {
      method: "POST",
      headers: { origin: "https://studio.example", "content-type": "application/json" },
      body: JSON.stringify(input),
    }), run);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ state: "AI_DRAFT_REQUIRES_REVIEW" });
    expect(run).toHaveBeenCalledOnce();
  });

  it("shows a truthful AI setup state on Today, requests and Automations instead of a fictitious result", () => {
    const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    const panel = read("src/features/operations/AiRequestBrief.tsx");
    const ops = read("src/features/operations/OperationalProductRoute.tsx");
    const overview = read("src/features/operations/StaffOverviewDashboard.tsx");
    expect(panel).toContain("AI is not activated");
    expect(panel).toContain("Generate AI intake brief");
    expect(panel).toContain("/api/internal/ai/request-brief");
    expect(ops).toContain("<AiRequestBrief");
    expect(ops).toContain("<AiOperationsStatus");
    expect(overview).toContain("<AiOperationsStatus");
    expect(read("src/features/operations/AiOperationsStatus.tsx")).toContain("provider proof pending");
  });
});
