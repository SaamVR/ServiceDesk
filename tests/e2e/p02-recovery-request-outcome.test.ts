import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestPasswordReset } from "../../src/app/auth/forgot-password/actions";
import { trustedAuthFeedback } from "../../src/features/auth/verified-auth-feedback";

const calls = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { resetPasswordForEmail: calls.send } }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string): never => { throw new Error("MOCK_REDIRECT:" + href); },
}));
const generic = "Password recovery is unavailable in this environment.";
function form(address = "fictional-owner@example.test") {
  const data = new FormData();
  data.set("email", address);
  return data;
}
async function destination(data = form()): Promise<string> {
  try { await requestPasswordReset(data); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toMatch(/^MOCK_REDIRECT:/);
    return decodeURIComponent(message.slice("MOCK_REDIRECT:".length));
  }
  throw Error("RECOVERY_ACTION_RETURNED_WITHOUT_REDIRECT");
}
describe("P02 recovery request truth: no misleading email receipt", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
    vi.stubEnv("SERVICEDESK_AUTH_REDIRECT_ORIGIN", "https://qa.example.test");
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://legacy-host.onrender.com");
    vi.stubEnv("VERCEL", "1");
    calls.send.mockReset().mockResolvedValue({ data: {}, error: null });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("only acknowledges an API-accepted request with the explicit recovery callback", async () => {
    expect(await destination(form("  Fictional-Owner@Example.Test  ")))
      .toBe("/auth/forgot-password/check-email");
    expect(calls.send).toHaveBeenCalledExactlyOnceWith(
      "fictional-owner@example.test",
      { redirectTo: "https://qa.example.test/auth/confirm?flow=recovery" },
    );
  });
  it("does not claim send success when Supabase returns an error object", async () => {
    calls.send.mockResolvedValueOnce({ data: null, error: { message: "private SMTP failure" } });
    const href = await destination();
    expect(href).toBe("/auth/forgot-password?error=" + generic);
    expect(href).not.toContain("SMTP");
    expect(href).not.toContain("check-email");
    expect(trustedAuthFeedback("forgot-password", "error", generic)).toBe(generic);
    expect(calls.send).toHaveBeenCalledTimes(1);
  });
  it("rejects provider transport exceptions without leaking provider details", async () => {
    calls.send.mockRejectedValueOnce(Error("private provider/network failure"));
    expect(await destination()).toBe("/auth/forgot-password?error=" + generic);
    expect(calls.send).toHaveBeenCalledTimes(1);
  });
  it("keeps identical generic successful outcomes for registered/unknown synthetic addresses", async () => {
    expect(await destination(form("unknown@example.test"))).toBe("/auth/forgot-password/check-email");
    expect(await destination(form("known@example.test"))).toBe("/auth/forgot-password/check-email");
    expect(calls.send).toHaveBeenCalledTimes(2);
  });
  it("blocks malformed address before contacting provider", async () => {
    expect(await destination(form("not-an-email"))).toContain("Enter a valid email address.");
    expect(calls.send).not.toHaveBeenCalled();
  });
  it("fails closed without configured HTTPS origin even when stale Render env remains", async () => {
    vi.stubEnv("SERVICEDESK_AUTH_REDIRECT_ORIGIN", "");
    expect(await destination()).toBe("/auth/forgot-password?error=" + generic);
    expect(calls.send).not.toHaveBeenCalled();
  });
  it("does not offer another password change when global sign-out is unverified", () => {
    const page = readFileSync("src/app/auth/reset-password/page.tsx", "utf8");
    expect(page).toContain('action="/auth/sign-out" method="post"');
    expect(page).toContain("{!sessionClosureUnverified ? (");
    expect(page).toContain("<form action={updateRecoveredPassword}");
    expect(page).not.toContain("{query.error}");
  });

});
