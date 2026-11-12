import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithPassword } from "../../src/app/auth/sign-in/actions";
import { trustedAuthFeedback } from "../../src/features/auth/verified-auth-feedback";

const calls = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { signInWithPassword: calls.signIn } }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string): never => { throw Error("MOCK_REDIRECT:" + href); },
}));

function form(next = "/auth/continue", email = "owner@example.test", password = "synthetic-valid-password") {
  const fd = new FormData();
  fd.set("next", next);
  fd.set("email", email);
  fd.set("password", password);
  return fd;
}
async function destination(fd = form()): Promise<URL> {
  try { await signInWithPassword(fd); }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    expect(message).toMatch(/^MOCK_REDIRECT:/);
    return new URL(message.slice("MOCK_REDIRECT:".length), "https://qa.example.test");
  }
  throw Error("SIGN_IN_WITHOUT_REDIRECT");
}
const signedIn = {
  data: { user: { email_confirmed_at: "2026-11-07T00:00:00Z" }, session: { access_token: "synthetic" } },
  error: null,
};

describe("P02 owner sign-in requires a verified returned session", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
    calls.signIn.mockReset().mockResolvedValue(signedIn);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("redirects to the normalized owner return path only after a user and session are returned", async () => {
    const url = await destination(form("/app/fictional/overview", "  OWNER@Example.Test  "));
    expect(url.pathname).toBe("/app/fictional/overview");
    expect(calls.signIn).toHaveBeenCalledExactlyOnceWith({
      email: "owner@example.test", password: "synthetic-valid-password",
    });
  });

  it("keeps the provider's invalid-credentials response generic and non-enumerating", async () => {
    calls.signIn.mockResolvedValueOnce({ data: { user: null, session: null },
      error: { message: "private invalid credentials" } });
    const url = await destination();
    expect(url.pathname).toBe("/auth/sign-in");
    expect(url.searchParams.get("error")).toBe("The email or password is incorrect.");
    expect(url.href).not.toContain("private");
  });

  it("does not mask a network exception as a wrong password or expose provider detail", async () => {
    calls.signIn.mockRejectedValueOnce(Error("private transport access token"));
    const url = await destination();
    expect(url.searchParams.get("error")).toBe("Sign in is temporarily unavailable.");
    expect(url.href).not.toContain("transport");
  });

  it("refuses partial success where the Auth response lacks a real session", async () => {
    calls.signIn.mockResolvedValueOnce({ data: { user: signedIn.data.user, session: null }, error: null });
    expect((await destination()).searchParams.get("error")).toBe("Sign in is temporarily unavailable.");
  });

  it("refuses a returned session without a verified email user", async () => {
    calls.signIn.mockResolvedValueOnce({
      data: { user: { email_confirmed_at: null }, session: signedIn.data.session }, error: null,
    });
    expect((await destination()).searchParams.get("error")).toBe("Sign in is temporarily unavailable.");
    calls.signIn.mockResolvedValueOnce({ data: { user: null, session: signedIn.data.session }, error: null });
    expect((await destination()).searchParams.get("error")).toBe("Sign in is temporarily unavailable.");
  });

  it("rejects malformed sign-in input before contacting Supabase", async () => {
    expect((await destination(form("/auth/continue", "", ""))).searchParams.get("error"))
      .toBe("Enter your email address and password.");
    expect(calls.signIn).not.toHaveBeenCalled();
  });

  it("preserves safe fallback for a hostile redirect on both success and failure", async () => {
    expect((await destination(form("//attacker.example"))).pathname).toBe("/auth/continue");
    calls.signIn.mockRejectedValueOnce(Error("network private"));
    const url = await destination(form("//attacker.example"));
    expect(url.pathname).toBe("/auth/sign-in");
    expect(url.searchParams.get("next")).toBe("/auth/continue");
    expect(url.searchParams.get("error")).toBe("Sign in is temporarily unavailable.");
    expect(trustedAuthFeedback("sign-in", "error", "Sign in is temporarily unavailable."))
      .toBe("Sign in is temporarily unavailable.");
  });
});
