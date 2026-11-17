import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trustedAuthFeedback } from "../../src/features/auth/verified-auth-feedback";
import { updateRecoveredPassword } from "../../src/app/auth/reset-password/actions";
import ResetPasswordPage from "../../src/app/auth/reset-password/page";

const calls = vi.hoisted(() => ({
  getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: calls }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string): never => { throw new Error("MOCK_REDIRECT:" + href); },
}));

const password = "Synthetic-Strong-Password-2026!";
const actorId = "11111111-1111-4111-8111-111111111111";
const uncertain = "Password update status could not be confirmed. Sign out before requesting a new reset link.";
const warning = "Password updated, but ending this session could not be confirmed. Sign out before leaving this device.";
function form(p = password, confirmation = p) {
  const data = new FormData();
  data.set("password", p);
  data.set("confirmation", confirmation);
  return data;
}
async function redirected(data = form()) {
  try { await updateRecoveredPassword(data); }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toMatch(/^MOCK_REDIRECT:/);
    return decodeURIComponent(message.slice("MOCK_REDIRECT:".length));
  }
  throw Error("RESET_ACTION_RETURNED_WITHOUT_REDIRECT");
}

describe("P02 password reset cannot claim sign-out on provider failure", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    calls.getUser.mockReset().mockResolvedValue({
      data: { user: { id: actorId,
        email_confirmed_at: "2026-11-07T00:00:00Z" } }, error: null,
    });
    calls.updateUser.mockReset().mockResolvedValue({ data: { user: { id: actorId } }, error: null });
    calls.signOut.mockReset().mockResolvedValue({ error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("only claims a fresh sign-in after the password change AND explicit sign-out success", async () => {
    const href = await redirected();
    expect(href).toContain("/auth/sign-in?notice=");
    expect(href).toContain("Password updated. Sign in with your new password.");
    expect(calls.updateUser).toHaveBeenCalledExactlyOnceWith({ password });
    expect(calls.signOut).toHaveBeenCalledTimes(1);
  });

  it("treats a signOut error as an unclosed session, not a successful logout", async () => {
    calls.signOut.mockResolvedValueOnce({ error: { message: "private provider failure" } });
    const href = await redirected();
    expect(href).toBe("/auth/reset-password?error=" + warning);
    expect(calls.updateUser).toHaveBeenCalledExactlyOnceWith({ password });
    expect(calls.signOut).toHaveBeenCalledTimes(1);
    expect(href).not.toContain("private provider failure");
    expect(href).not.toContain("/auth/sign-in?notice=");
    expect(trustedAuthFeedback("reset-password", "error", warning)).toBe(warning);
  });

  it("handles thrown provider signOut without another password mutation or a false receipt", async () => {
    calls.signOut.mockRejectedValueOnce(Error("provider transport outage"));
    expect(await redirected()).toBe("/auth/reset-password?error=" + warning);
    expect(calls.updateUser).toHaveBeenCalledTimes(1);
    expect(calls.signOut).toHaveBeenCalledTimes(1);
  });

  it("never attempts to sign out or claims success on updateUser error or throw", async () => {
    calls.updateUser.mockResolvedValueOnce({ error: { message: "secret" } });
    expect(await redirected()).toContain("Password could not be updated.");
    expect(calls.signOut).not.toHaveBeenCalled();
    calls.updateUser.mockRejectedValueOnce(Error("private transport error"));
    expect(await redirected()).toContain(uncertain);
    expect(calls.signOut).not.toHaveBeenCalled();
  });

  it("rejects invalid credentials or mismatched passwords before contacting Auth", async () => {
    expect(await redirected(form("short"))).toContain("Choose a new password");
    expect(await redirected(form(password, "different"))).toContain("passwords do not match");
    expect(calls.getUser).not.toHaveBeenCalled();
    expect(calls.updateUser).not.toHaveBeenCalled();
    expect(calls.signOut).not.toHaveBeenCalled();
  });

  it("rejects an unverified session before attempting to change a password", async () => {
    calls.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect(await redirected()).toContain("/auth/forgot-password?error=");
    expect(calls.updateUser).not.toHaveBeenCalled();
    expect(calls.signOut).not.toHaveBeenCalled();
  });

  it("refuses thrown and partial recovery identity before changing any credential", async () => {
    calls.getUser.mockRejectedValueOnce(Error("PRIVATE_RECOVERY_AUTH_TRANSPORT"));
    const outage = await redirected();
    expect(outage).toContain("/auth/forgot-password?error=");
    expect(outage).not.toContain("PRIVATE_RECOVERY_AUTH_TRANSPORT");
    calls.getUser.mockResolvedValueOnce({ data: { user: {
      email_confirmed_at: "2026-11-07T00:00:00Z",
    } }, error: null });
    expect(await redirected()).toContain("/auth/forgot-password?error=");
    expect(calls.updateUser).not.toHaveBeenCalled();
    expect(calls.signOut).not.toHaveBeenCalled();
  });

  it("refuses to claim a saved password from error-free, missing or foreign Auth update receipts", async () => {
    for (const data of [
      null,
      { user: null },
      { user: { email_confirmed_at: "2026-11-07T00:00:00Z" } },
      { user: { id: "22222222-2222-4222-8222-222222222222" } },
    ]) {
      calls.updateUser.mockResolvedValueOnce({ data, error: null });
      expect(await redirected()).toBe("/auth/reset-password?error=" + uncertain);
    }
    expect(calls.updateUser).toHaveBeenCalledTimes(4);
    expect(calls.signOut).not.toHaveBeenCalled();
    expect(trustedAuthFeedback("reset-password", "error", uncertain)).toBe(uncertain);
  });

  it("refuses a raw 500 or password form after a thrown recovery-page Auth read", async () => {
    calls.getUser.mockRejectedValueOnce(Error("PRIVATE_RECOVERY_PAGE_AUTH"));
    await expect(ResetPasswordPage({ searchParams: Promise.resolve({}) }))
      .rejects.toThrow("MOCK_REDIRECT:/auth/forgot-password");
    calls.getUser.mockResolvedValueOnce({ data: { user: {
      email_confirmed_at: "2026-11-07T00:00:00Z",
    } }, error: null });
    await expect(ResetPasswordPage({ searchParams: Promise.resolve({}) }))
      .rejects.toThrow("MOCK_REDIRECT:/auth/forgot-password");
    expect(calls.updateUser).not.toHaveBeenCalled();
  });

  it("offers only POST sign-out, never a second password write, for uncertain update outcomes", async () => {
    const tree = await ResetPasswordPage({ searchParams: Promise.resolve({ error: uncertain }) });
    const forms: Array<{action?: unknown;method?: string}> = [];
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) return void node.forEach(visit);
      if (!node || typeof node !== "object") return;
      const jsx = node as {type?: unknown;props?: {children?: unknown;action?: unknown;method?: string}};
      if (jsx.type === "form") forms.push({action:jsx.props?.action,method:jsx.props?.method});
      visit(jsx.props?.children);
    };
    visit(tree);
    expect(forms).toEqual([{action:"/auth/sign-out",method:"post"}]);
    expect(calls.updateUser).not.toHaveBeenCalled();
    expect(calls.signOut).not.toHaveBeenCalled();
  });

  it("presents a POST sign-out retry on the real reset screen, not a GET side effect", () => {
    const action = readFileSync("src/app/auth/reset-password/actions.ts", "utf8");
    const page = readFileSync("src/app/auth/reset-password/page.tsx", "utf8");
    const route = readFileSync("src/app/auth/sign-out/route.ts", "utf8");
    expect(action).toContain("signedOut = !result.error");
    expect(action).toContain("if (!signedOut)");
    expect(page).toContain('action="/auth/sign-out" method="post"');
    expect(page).toContain("sessionClosureUnverified");
    expect(route).toContain("export async function POST");
    expect(route).toContain("if (error)");
    expect(page).not.toContain("{query.error}");
  });
});
