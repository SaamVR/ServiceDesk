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
const input = { workspaceSlug: "fictional-cleaning", requestId };

function harness(options: {
  role?: string;
  branch?: string;
  disabled?: boolean;
  absent?: boolean;
  modelTools?: boolean;
} = {}) {
  const filters: Array<[string, unknown]> = [];
  const service = {
    from(table: string) {
      expect(table).toBe("requests");
      const query = {
        select() { return query; },
        eq(key: string, value: unknown) { filters.push([key, value]); return query; },
        async maybeSingle() {
          return {
            error: null,
            data: options.absent ? null : {
              id: requestId,
              workspace_id: workspaceId,
              branch_id: options.branch ?? branchId,
              service_code: "MOVE_OUT",
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
    expect(prompt.workspaceId).toBe(workspaceId);
    expect(prompt.userText).not.toContain("private@example.com");
    expect(prompt.userText).not.toContain("never send to model");
    expect(prompt.userText).toContain('"serviceCode":"MOVE_OUT"');
    return { ok: true as const, value: {
      output: {},
      replyDraft: "Saved move-out enquiry: three bedrooms, two bathrooms. Confirm the cleaning scope and preferred timing with staff.",
      requestedToolCalls: options.modelTools ? [{ name: "sendEmail" }] : [],
    } };
  });
  const resolve = vi.fn(async () => ({
    ok: true, value: {
      workspace: { id: workspaceId, slug: input.workspaceSlug, timezone: "UTC", currency: "USD", name: "QA" },
      actor: { workspaceId, userId: "user_qa", role: options.role ?? "OWNER" },
      service,
      branchScope: { mode: "BRANCH", selectedBranchId: branchId, branches: [] },
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
  return { deps, model, resolve, config, filters };
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

  it("never generates from a nonexistent request or from a model tool command", async () => {
    const missing = harness({ absent: true });
    expect(await generateAuthorizedRequestBrief(input, missing.deps))
      .toMatchObject({ ok: false, code: "AI_BRIEF_NOT_FOUND" });
    expect(missing.model).not.toHaveBeenCalled();

    const tools = harness({ modelTools: true });
    expect(await generateAuthorizedRequestBrief(input, tools.deps))
      .toMatchObject({ ok: false, code: "AI_BRIEF_OUTPUT_UNSAFE" });
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
