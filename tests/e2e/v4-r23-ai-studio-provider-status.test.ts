import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";

const source=readFileSync(join(process.cwd(),"src/features/operations/AiStudioWorkspace.tsx"),"utf8");

describe("R23 AI Studio provider experience",()=>{
  it("displays server-selected provider identity without exposing bearer secrets",()=>{
    expect(source).toContain('process.env.SERVICEDESK_AI_PROVIDER === "codex_gateway"');
    expect(source).toContain("Private Codex Gateway");
    expect(source).toContain("OpenAI API");
    expect(source).not.toContain("process.env.SERVICEDESK_CODEX_GATEWAY_KEY");
    expect(source).toContain("readConfiguredAiRuntimeConfig()");
  });
  it("distinguishes independent Codex test-workspace authorization from default API keys",()=>{
    expect(source).toContain("SERVICEDESK_CODEX_GATEWAY_TEST_WORKSPACE_ID");
    expect(source).toContain("SERVICEDESK_CODEX_GATEWAY_KEY");
    expect(source).toContain("not verified by this status");
    expect(source).toContain("OPENAI_API_KEY");
    expect(source).toContain('data.actor.role === "OWNER"');
  });
});
