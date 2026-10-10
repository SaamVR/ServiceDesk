import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resend: vi.fn(),
  redirect: vi.fn((url: string): never => { throw new Error("NEXT_REDIRECT:" + url); }),
  createServerClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => {
    mocks.createServerClient(...args);
    return { auth: { resend: mocks.resend } };
  },
}));

import { resendSignupConfirmation } from "../../src/app/auth/sign-up/check-email/actions";

const ready = {
  SERVICEDESK_OWNER_REGISTRATION_ENABLED: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
  SERVICEDESK_AUTH_REDIRECT_ORIGIN: "https://servicedesk-v2-multilane-gate.onrender.com",
};

function form(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

describe("V3 accessible resend-confirmation path", () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(ready)) vi.stubEnv(key, value);
    mocks.resend.mockReset();
    mocks.resend.mockResolvedValue({ data: {}, error: null });
    mocks.createServerClient.mockReset();
    mocks.redirect.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sends only from the public Supabase client using the trusted token callback", async () => {
    await expect(resendSignupConfirmation(form("  OWNER@Example.COM  "))).rejects.toThrow("NEXT_REDIRECT:");
    expect(mocks.resend).toHaveBeenCalledOnce();
    expect(mocks.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "owner@example.com",
      options: {
        emailRedirectTo: "https://servicedesk-v2-multilane-gate.onrender.com/auth/confirm",
      },
    });
    expect(mocks.createServerClient).toHaveBeenCalledWith(
      "https://example.supabase.co", "sb_publishable_synthetic", expect.any(Object),
    );
  });

  it("does not disclose registration existence or transient SMTP errors", async () => {
    mocks.resend.mockResolvedValue({ data: null, error: { message: "Unknown user" } });
    await expect(resendSignupConfirmation(form("missing@example.com"))).rejects.toThrow(
      "NEXT_REDIRECT:/auth/sign-up/check-email?notice=",
    );
    expect(mocks.redirect.mock.calls.at(-1)?.[0]).toContain(
      encodeURIComponent("If this address has an account awaiting verification"),
    );
  });

  it("blocks replay when the public signup release switch is off", async () => {
    vi.stubEnv("SERVICEDESK_OWNER_REGISTRATION_ENABLED", "false");
    await expect(resendSignupConfirmation(form("owner@example.com"))).rejects.toThrow("NEXT_REDIRECT:");
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it("rejects malformed input before contacting the provider", async () => {
    await expect(resendSignupConfirmation(form("invalid-address"))).rejects.toThrow("NEXT_REDIRECT:");
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it("provides an accessible resend form with no staging bypass when release is disabled", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/auth/sign-up/check-email/page.tsx"), "utf8",
    );
    expect(page).toContain("ownerRegistrationAvailable()");
    expect(page).toContain('action={resendSignupConfirmation}');
    expect(page).toContain('type="email"');
    expect(page).toContain('role="status"');
    expect(page).toContain("Only request a new link for your own email address.");
  });
});
