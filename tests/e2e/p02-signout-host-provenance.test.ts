import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../src/app/auth/sign-out/route";

const signingOut = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    config: { cookies: { setAll: (values: Array<{
      name: string; value: string; options: { path: string; httpOnly: boolean };
    }>) => void } },
  ) => ({
    auth: {
      signOut: async () => {
        config.cookies.setAll([{
          name: "sb-synthetic-auth-token",
          value: "",
          options: { path: "/", httpOnly: true },
        }]);
        return signingOut();
      },
    },
  }),
}));

const origin = "https://approved-servicedesk.example.test";

describe("P02 sign-out redirect provenance", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic");
    vi.stubEnv("SERVICEDESK_AUTH_REDIRECT_ORIGIN", origin);
    vi.stubEnv("RENDER_EXTERNAL_URL", "");
    signingOut.mockReset();
    signingOut.mockResolvedValue({ error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("never follows an inbound hostile request Host for post-logout redirects", async () => {
    const request = new NextRequest("https://untrusted-origin.example.test/auth/sign-out", {
      method: "POST",
    });
    const response = await POST(request);
    expect(response.status).toBe(303);
    expect(response.headers.get("location"))
      .toBe(origin + "/auth/sign-in?notice=You%20have%20been%20signed%20out.");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("set-cookie")).toContain("sb-synthetic-auth-token=");
    expect(signingOut).toHaveBeenCalledTimes(1);
  });

  it("fails closed without a trusted HTTPS origin before touching the session", async () => {
    vi.stubEnv("SERVICEDESK_AUTH_REDIRECT_ORIGIN", "");
    const response = await POST(new NextRequest("https://untrusted.example.test/auth/sign-out", {
      method: "POST",
    }));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("location")).toBeNull();
    expect(signingOut).not.toHaveBeenCalled();
  });
});
