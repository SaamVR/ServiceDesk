import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../../src/app/auth/confirm/route";

const auth = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    config: { cookies: { setAll: (cookies: Array<{name:string;value:string;options:{path:string;httpOnly:boolean}}>) => void } },
  ) => ({
    auth: {
      verifyOtp: async (input: unknown) => {
        const result = await auth.verifyOtp(input);
        if (!result.error) {
          config.cookies.setAll([{
            name: "sb-staging-auth-token",
            value: "safe-test-cookie",
            options: { path: "/", httpOnly: true },
          }]);
        }
        return result;
      },
      exchangeCodeForSession: async (code: string) => {
        const result = await auth.exchangeCodeForSession(code);
        if (!result.error) {
          config.cookies.setAll([{
            name: "sb-staging-auth-token",
            value: "safe-test-cookie",
            options: { path: "/", httpOnly: true },
          }]);
        }
        return result;
      },
      getUser: auth.getUser,
    },
  }),
}));

const base = "https://servicedesk-v2-multilane-gate.onrender.com";
const verified = () => ({
  data: {
    user: { id: "synthetic-user", email_confirmed_at: "2026-10-11T00:00:00Z" },
    session: { access_token: "not-a-live-token" },
  },
  error: null,
});

describe("V3 server-side email verification session handoff", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
    vi.stubEnv("SERVICEDESK_AUTH_REDIRECT_ORIGIN", base);
    auth.verifyOtp.mockReset();
    auth.exchangeCodeForSession.mockReset();
    auth.getUser.mockReset();
    auth.verifyOtp.mockResolvedValue(verified());
    auth.exchangeCodeForSession.mockResolvedValue(verified());
    // A second user lookup on the stale initial request must never run.
    auth.getUser.mockRejectedValue(new Error("Stale inbound cookies"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("verifies the signup token-hash email and sends fresh cookies to the public continuation", async () => {
    const response = await GET(new NextRequest(base + "/auth/confirm?token_hash=synthetic_token_hash_123&type=email"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(base + "/auth/continue");
    expect(response.headers.get("set-cookie")).toContain("sb-staging-auth-token=");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "synthetic_token_hash_123",
      type: "email",
    });
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("preserves the recovery flow and cookie session without following client-origin redirects", async () => {
    const response = await GET(new NextRequest(base + "/auth/confirm?flow=recovery&token_hash=synthetic_recovery_hash_123"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(base + "/auth/reset-password");
    expect(response.headers.get("set-cookie")).toContain("sb-staging-auth-token=");
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "synthetic_recovery_hash_123",
      type: "recovery",
    });
  });

  it("supports verified PKCE code exchange through the same cookie path", async () => {
    const response = await GET(new NextRequest(base + "/auth/confirm?code=synthetic-pkce-code"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(base + "/auth/continue");
    expect(response.headers.get("set-cookie")).toContain("sb-staging-auth-token=");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("synthetic-pkce-code");
  });

  it("rejects unverified identities even if a provider returns a session", async () => {
    auth.verifyOtp.mockResolvedValue({
      ...verified(),
      data: { ...verified().data, user: { email_confirmed_at: null } },
    });
    const response = await GET(new NextRequest(base + "/auth/confirm?token_hash=synthetic_token_hash_123"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("/auth/sign-in?error=");
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("fails closed when the new session is missing or the Auth provider rejects the token", async () => {
    auth.verifyOtp.mockResolvedValueOnce({
      ...verified(),
      data: { ...verified().data, session: null },
    });
    const noSession = await GET(new NextRequest(base + "/auth/confirm?token_hash=synthetic_token_hash_123"));
    expect(noSession.headers.get("location")).toContain("/auth/sign-in?error=");

    auth.verifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "Expired" },
    });
    const expired = await GET(new NextRequest(base + "/auth/confirm?token_hash=synthetic_token_hash_123"));
    expect(expired.headers.get("location")).toContain("/auth/sign-in?error=");
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("does not trust spoofed request origin or unconfigured preview environments", async () => {
    const spoofed = await GET(new NextRequest("https://spoofed.test/auth/confirm?token_hash=synthetic_token_hash_123"));
    expect(spoofed.headers.get("location")).toBe(base + "/auth/continue");

    vi.stubEnv("SERVICEDESK_AUTH_REDIRECT_ORIGIN", "");
    vi.stubEnv("RENDER_EXTERNAL_URL", "");
    const missingOrigin = await GET(new NextRequest(base + "/auth/confirm?token_hash=synthetic_token_hash_123"));
    expect(missingOrigin.status).toBe(503);
  });
});
