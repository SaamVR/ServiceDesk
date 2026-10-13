import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { generateAuthorizedQuoteReview, type QuoteReviewDependencies } from "../../src/server/ai/quote-review";

const workspaceId="11111111-1111-4111-8111-111111111111";
const quoteId="22222222-2222-4222-8222-222222222222";
const staffId="33333333-3333-4333-8333-333333333333";
const quote = {
  id: quoteId, workspace_id: workspaceId, status: "APPROVED",
  valid_until: "2099-01-01T00:00:00.000Z",
  subtotal_minor: 32000, tax_minor: 0, total_minor: 32000,
  deposit_minor: 8000, balance_minor: 24000, duration_minutes: 210,
  snapshot: { lineItems: [
    { code: "BASE", description: "Private customer notes are hidden", amountMinor: 20000, durationMinutes: 120 },
    { code: "BEDROOM", description: "Bedrooms", amountMinor: 9000, durationMinutes: 60 },
    { code: "OVEN", description: "Optional oven clean", amountMinor: 3000, durationMinutes: 30 },
  ] },
};
function deps(row: Record<string, unknown>, onModel: (prompt: string) => void): QuoteReviewDependencies {
  const service={
    from(_table: string) {
      return {
        select(_fields: string) { return this; },
        eq(_key: string, _value: string) { return this; },
        async maybeSingle() { return { data: row, error: null }; },
      };
    },
  };
  return {
    resolveActor: async () => ({ ok: true,
      value: { workspace: { id: workspaceId, slug: "ctg" },
        actor: { workspaceId, userId: staffId, role: "OWNER" },
        service, branchScope: { mode: "ALL", branches: [] } },
    } as never),
    authorizeQuote: async () => undefined,
    readConfig: () => ({ ok: true, value: {
      apiBaseUrl: "https://api.openai.com/v1", apiKey: "mock-only-test",
      model: "model-test", timeoutMs: 1000, maxOutputTokens: 1024,
      now: () => "2026-10-13T04:00:00Z",
    } }),
    callModel: async (_config,input) => {
      onModel(input.userText);
      return { ok: true, value: {
        output: {}, replyDraft: "Check oven confirmation and room counts against saved customer requirements before sharing.",
        requestedToolCalls: [], citations: [],
      } };
    },
  };
}

describe("real staff-triggered AI quality review on persisted quote", () => {
  test("requires real authenticated staff and a saved quote id", async () => {
    const invalid = await generateAuthorizedQuoteReview({workspaceSlug:"ctg",quoteId:"bad"},deps(quote,()=>{}));
    expect(invalid).toMatchObject({ok:false,code:"AI_QUOTE_INPUT_INVALID"});
    const denied=await generateAuthorizedQuoteReview({workspaceSlug:"ctg",quoteId},{
      resolveActor: async()=>({ok:false,kind:"authentication",message:"No session"}),
    } as QuoteReviewDependencies);
    expect(denied).toMatchObject({ok:false,code:"AI_QUOTE_AUTH_REQUIRED"});
  });
  test("triggers real model port only after saved financial evidence and branch scope", async () => {
    let modelPrompt="";
    const result = await generateAuthorizedQuoteReview({workspaceSlug:"ctg",quoteId},
      deps(quote,s=>{modelPrompt=s;}));
    expect(result).toMatchObject({ok:true,value:{state:"AI_STAFF_REVIEW_ONLY",
      quoteId, source:"VERIFIED_SAVED_QUOTE_CODES_NO_AMOUNTS"}});
    expect(modelPrompt).toContain('"serviceCode":"OVEN"');
    expect(modelPrompt).toContain('"durationMinutes":30');
    expect(modelPrompt).not.toContain("32000");
    expect(modelPrompt).not.toContain("3000");
    expect(modelPrompt).not.toContain("Private customer notes");
    expect(modelPrompt).not.toContain(workspaceId);
  });
  test("blocks corrupt sums, no saved itemization, expired or non-approved quote before paid call", async () => {
    for(const patch of [
      { status: "DRAFT" }, { valid_until:"2010-01-01T00:00:00Z" },
      { subtotal_minor: 31000 }, { deposit_minor: 7000 },
      { snapshot: {} }, { workspace_id:"foreign-workspace" },
    ]) {
      let called=false;
      const result = await generateAuthorizedQuoteReview({workspaceSlug:"ctg",quoteId},
        deps({...quote,...patch},()=>{called=true;}));
      expect(result.ok).toBe(false);
      expect(called).toBe(false);
    }
  });
  test("wires an explicit staff-only button and avoids automatic delivery", () => {
    const ui=readFileSync(join(process.cwd(),"src/features/operations/AiQuoteReview.tsx"),"utf8");
    const page=readFileSync(join(process.cwd(),"src/features/operations/OperationalProductRoute.tsx"),"utf8");
    expect(ui).toContain("Generate AI review checks");
    expect(ui).toContain('fetch("/api/internal/ai/quote-review", {');
    expect(ui).toContain("signal: controller.signal");
    expect(page).toContain("<AiQuoteReview key={selectedQuote.id}");
    expect(ui).toContain("It cannot approve, send or change this quote.");
  });
});
