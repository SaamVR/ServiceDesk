import { describe, expect, it } from "vitest";
import { GET } from "../../src/app/health/route";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("V2 release health and Render readiness", () => {
  it("provides a dependency-free no-store liveness response", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "servicedesk",
      status: "live",
    });
  });

  it("pins the RC service to canonical with the repository RC gate and health check", () => {
    const yaml = readFileSync(join(process.cwd(), "render.yaml"), "utf8");
    expect(yaml).toContain("branch: feat/servicedesk-v2-multilane-20261006");
    expect(yaml).toContain("autoDeployTrigger: off");
    expect(yaml).toContain("pnpm check:rc");
    expect(yaml).toContain("healthCheckPath: /health");
  });

  it("declares required Supabase secret names without committing secret values or migrations", () => {
    const yaml = readFileSync(join(process.cwd(), "render.yaml"), "utf8");
    expect(yaml).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(yaml).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(yaml).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(yaml).toContain("SERVICEDESK_EMAIL_WEBHOOK_SECRET");
    expect(yaml).toContain("SERVICEDESK_EMAIL_ACCOUNT_WORKSPACE_MAP");
    expect(yaml).toContain("SERVICEDESK_VOICE_WEBHOOK_SECRET");
    expect(yaml).toContain("SERVICEDESK_VOICE_ACCOUNT_WORKSPACE_MAP");
    expect(yaml).toContain("SERVICEDESK_EMAIL_INBOUND_PROOF_JSON");
    expect(yaml).toContain("SERVICEDESK_VOICE_INBOUND_PROOF_JSON");
    expect(yaml.match(/sync: false/g)?.length).toBeGreaterThanOrEqual(9);
    expect(yaml).not.toMatch(/preDeployCommand|supabase db push|migration up/i);
  });
});
