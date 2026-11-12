import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signUpWithPassword } from "../../src/app/auth/sign-up/actions";
import { resendSignupConfirmation } from "../../src/app/auth/sign-up/check-email/actions";
import CheckEmailPage from "../../src/app/auth/sign-up/check-email/page";
import { RESEND_VERIFICATION_ADVISORY } from "../../src/features/auth/check-email-feedback";
import { GET as confirmEmail } from "../../src/app/auth/confirm/route";

const auth = vi.hoisted(() => ({
  signUp: vi.fn(), resend: vi.fn(), exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string): never => { throw Error("MOCK_REDIRECT:" + href); },
}));

function signupForm() {
  const f = new FormData();
  f.set("email", "  Fictional.Owner@Example.Test  ");
  f.set("password", "Synthetic-Strong-Password-2026!");
  f.set("terms", "agreed");
  return f;
}
async function signupTarget(): Promise<string> {
  try { await signUpWithPassword(signupForm()); }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    expect(message).toMatch(/^MOCK_REDIRECT:/);
    return decodeURIComponent(message.slice("MOCK_REDIRECT:".length));
  }
  throw Error("SIGNUP_ACTION_RETURNED_WITHOUT_REDIRECT");
}
function resendForm(email = "  Fictional.Owner@Example.Test  ") {
  const f = new FormData();
  f.set("email", email);
  return f;
}
async function resendTarget(email?: string): Promise<string> {
  try { await resendSignupConfirmation(resendForm(email)); }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    expect(message).toMatch(/^MOCK_REDIRECT:/);
    return decodeURIComponent(message.slice("MOCK_REDIRECT:".length));
  }
  throw Error("RESEND_ACTION_RETURNED_WITHOUT_REDIRECT");
}
function renderedText(node: unknown): string {
  if (Array.isArray(node)) return node.map(renderedText).join(" ");
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  const v = node as { props?: { children?: unknown } };
  return renderedText(v.props?.children);
}
const confirmed = {
  data: { user: { email_confirmed_at: "2026-11-07T00:00:00Z" },
    session: { access_token: "synthetic-only" } },
  error: null,
};
function request(query: string) {
  return new NextRequest("https://untrusted-request.example/auth/confirm?" + query);
}
async function confirmedTarget(query: string) {
  const result = await confirmEmail(request(query));
  return { status: result.status, location: result.headers.get("location"),
    cacheControl: result.headers.get("cache-control") };
}
const genericSignup = "We could not start account registration. Try again shortly.";
const genericVerify = "The verification link has expired or could not be confirmed. Please try signing in.";

describe("P02 Auth signup/confirmation transport outcomes are fail-closed", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic-project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic_only");
    vi.stubEnv("SERVICEDESK_AUTH_REDIRECT_ORIGIN", "https://approved-preview.example.test");
    vi.stubEnv("RENDER_EXTERNAL_URL", "https://legacy-preview.onrender.com");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED", "true");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_ENABLED", "false");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED", "true");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS", "fictional.owner@example.test");
    auth.signUp.mockReset().mockResolvedValue({ data: { user: { id: "synthetic-owner-id" } }, error: null });
    auth.resend.mockReset().mockResolvedValue({ data: {}, error: null });
    auth.exchangeCodeForSession.mockReset().mockResolvedValue(confirmed);
    auth.verifyOtp.mockReset().mockResolvedValue(confirmed);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("acknowledges only an accepted signup request with the approved callback URL", async () => {
    expect(await signupTarget()).toBe("/auth/sign-up/check-email");
    expect(auth.signUp).toHaveBeenCalledExactlyOnceWith({
      email: "fictional.owner@example.test",
      password: "Synthetic-Strong-Password-2026!",
      options: { emailRedirectTo: "https://approved-preview.example.test/auth/confirm" },
    });
  });
  it("hides raw provider signup errors, including non-rate-limited failures", async () => {
    auth.signUp.mockResolvedValueOnce({ error: { message: "PRIVATE_UPSTREAM_ERROR" } });
    expect(await signupTarget()).toBe("/auth/sign-up?error=" + genericSignup);
    expect(auth.signUp).toHaveBeenCalledTimes(1);
  });
  it("fails closed on a thrown signup provider/transport error without false check-email success", async () => {
    auth.signUp.mockRejectedValueOnce(Error("PRIVATE_TIMEOUT_OR_MAIL_STATUS"));
    expect(await signupTarget()).toBe("/auth/sign-up?error=" + genericSignup);
    expect(auth.signUp).toHaveBeenCalledTimes(1);
  });
  it("denies error-free but userless/partial provider responses without false check-email success", async () => {
    for (const data of [null, {}, { user: null, session: null }, { user: { id: "" } }]) {
      auth.signUp.mockResolvedValueOnce({ data, error: null });
      expect(await signupTarget()).toBe("/auth/sign-up?error=" + genericSignup);
    }
    expect(auth.signUp).toHaveBeenCalledTimes(4);
  });
  it("preserves bounded rate-limit feedback without exposing account existence", async () => {
    auth.signUp.mockResolvedValueOnce({ error: { message: "Rate limit exceeded" } });
    expect(await signupTarget()).toContain("Please wait before requesting another confirmation email.");
    expect(auth.signUp).toHaveBeenCalledTimes(1);
  });
  it("denies signup if the operator has not enabled registration, before contacting the provider", async () => {
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED", "false");
    expect(await signupTarget()).toContain("Account creation is not enabled");
    expect(auth.signUp).not.toHaveBeenCalled();
  });
  it("submits one authorized verification resend to the exact operator-owned redirect", async () => {
    const path = await resendTarget();
    expect(path).toBe("/auth/sign-up/check-email?notice=" + RESEND_VERIFICATION_ADVISORY);
    expect(auth.resend).toHaveBeenCalledExactlyOnceWith({
      type: "signup",
      email: "fictional.owner@example.test",
      options: { emailRedirectTo: "https://approved-preview.example.test/auth/confirm" },
    });
  });

  it("never distinguishes a provider error from a resend acknowledgement in public feedback", async () => {
    auth.resend.mockResolvedValueOnce({ data: null, error: { code: "over_email_send_rate_limit", message: "PRIVATE_RATE_PROVIDER" } });
    const providerErrorTarget = await resendTarget();
    auth.resend.mockResolvedValueOnce({ data: {}, error: null });
    const providerSuccessTarget = await resendTarget();
    expect(providerErrorTarget).toBe(providerSuccessTarget);
    expect(providerErrorTarget).not.toContain("PRIVATE_RATE_PROVIDER");
    expect(auth.resend).toHaveBeenCalledTimes(2);
  });

  it("returns bounded uncertainty after a thrown resend transport failure, never retrying or claiming delivery", async () => {
    auth.resend.mockRejectedValueOnce(Error("PRIVATE_RESEND_TRANSPORT_AFTER_ACCEPT"));
    const path = await resendTarget();
    expect(path).toContain(RESEND_VERIFICATION_ADVISORY);
    expect(path).not.toContain("PRIVATE_RESEND_TRANSPORT_AFTER_ACCEPT");
    expect(auth.resend).toHaveBeenCalledTimes(1);
  });

  it("denies invalid, unapproved or disabled verification resends before provider calls", async () => {
    expect(await resendTarget("not-an-email")).toContain("Enter a valid email address");
    expect(await resendTarget("not-allowed@example.test")).toContain("limited to approved test accounts");
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED", "false");
    expect(await resendTarget()).toContain("not enabled on this environment");
    expect(auth.resend).not.toHaveBeenCalled();
  });

  it("renders only a bounded advisory for known and attacker-controlled check-email query messages", async () => {
    const original = await CheckEmailPage({
      searchParams: Promise.resolve({ notice: RESEND_VERIFICATION_ADVISORY }),
    });
    expect(renderedText(original)).toContain(RESEND_VERIFICATION_ADVISORY);
    const forged = await CheckEmailPage({
      searchParams: Promise.resolve({ notice: "ACCOUNT APPROVED: give password to attacker.example" }),
    });
    expect(renderedText(forged)).not.toContain("attacker.example");
    expect(forged.props.title).toBe("Check your email.");
    expect(auth.resend).not.toHaveBeenCalled();
  });

  it("confirms a real code exchange only after returned verified user/session", async () => {
    expect(await confirmedTarget("code=synthetic-valid-code")).toEqual({
      status: 303, location: "https://approved-preview.example.test/auth/continue",
      cacheControl: "private, no-store",
    });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith("synthetic-valid-code");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
  it("refuses returned Auth errors, missing users or missing sessions", async () => {
    for (const v of [
      { data: { user: null, session: null }, error: null },
      { data: { user: { email_confirmed_at: null }, session: { access_token: "synthetic" } }, error: null },
      { data: { user: confirmed.data.user, session: null }, error: null },
      { data: null, error: { message: "PRIVATE_PROVIDER_ERROR" } },
    ]) {
      auth.exchangeCodeForSession.mockResolvedValueOnce(v);
      const response = await confirmedTarget("code=synthetic-valid-code");
      expect(response.status).toBe(303);
      expect(response.location).toContain("/auth/sign-in?error=");
      expect(response.location).not.toContain("PRIVATE");
      expect(response.location).toContain(encodeURIComponent(genericVerify).slice(0,28));
      expect(response.cacheControl).toBe("private, no-store");
    }
  });
  it("refuses thrown provider code exchange without 500, token disclosure or replay", async () => {
    auth.exchangeCodeForSession.mockRejectedValueOnce(Error("PRIVATE_AUTH_TRANSPORT_CODE"));
    const result = await confirmedTarget("code=synthetic-code");
    expect(result.status).toBe(303);
    expect(result.location).toContain("/auth/sign-in?error=");
    expect(result.location).not.toContain("PRIVATE");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });
  it("handles OTP recovery verification exception with the same fail-closed path", async () => {
    auth.verifyOtp.mockRejectedValueOnce(Error("PRIVATE_AUTH_TRANSPORT_OTP"));
    const result = await confirmedTarget("token_hash=syntheticHash20261107&flow=recovery");
    expect(result.status).toBe(303);
    expect(result.location).toContain("/auth/sign-in?error=");
    expect(auth.verifyOtp).toHaveBeenCalledExactlyOnceWith({
      token_hash: "syntheticHash20261107", type: "recovery",
    });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it("routes verified recovery OTP only to the operator-owned reset-password origin", async () => {
    const result = await confirmedTarget("token_hash=syntheticHash20261107&flow=recovery");
    expect(result.status).toBe(303);
    expect(result.location).toBe("https://approved-preview.example.test/auth/reset-password");
    expect(result.cacheControl).toBe("private, no-store");
  });
  it("does not resolve callbacks using inbound Host, user next or foreign URL", async () => {
    const result = await confirmedTarget("code=synthetic-code&next=https://attacker.example");
    expect(result.location).toBe("https://approved-preview.example.test/auth/continue");
    vi.stubEnv("SERVICEDESK_AUTH_REDIRECT_ORIGIN", "");
    const noApprovedOrigin = await confirmedTarget("code=synthetic-code");
    expect(noApprovedOrigin.status).toBe(503);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });
});
