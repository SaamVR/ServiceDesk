import { describe, expect, it } from "vitest";
import {
  ownerRegistrationAvailable, ownerRegistrationEmailAllowed,
  ownerRegistrationMode, ownerRegistrationPubliclyAvailable,
} from "../../src/features/auth/owner-registration-readiness";

const base: NodeJS.ProcessEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://synthetic-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
  SERVICEDESK_AUTH_REDIRECT_ORIGIN: "https://servicedesk-v3-frontend-review.onrender.com",
  SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS: "owner-a@example.test,owner-b@example.test",
};
const attested = {
  ...base, SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED: "true",
};
describe("P02 shared main Supabase onboarding activation authority", () => {
  it("blocks both public and QA signup by default, even with complete connection settings", () => {
    for (const mode of [
      { SERVICEDESK_OWNER_REGISTRATION_ENABLED: "true" },
      { SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED: "true" },
      { SERVICEDESK_OWNER_REGISTRATION_ENABLED: "true",
        SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED: "true" },
    ]) {
      const env = { ...base, ...mode };
      expect(ownerRegistrationMode(env)).toBe("DISABLED");
      expect(ownerRegistrationAvailable(env)).toBe(false);
      expect(ownerRegistrationEmailAllowed("owner-a@example.test", env)).toBe(false);
      expect(ownerRegistrationPubliclyAvailable(env)).toBe(false);
    }
  });

  it("requires the exact server-owned tenant authority acknowledgement", () => {
    for (const denied of [undefined, "", "false", "TRUE", "1", "approved"]) {
      expect(ownerRegistrationMode({
        ...attested,
        SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED: denied,
        SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED: "true",
      })).toBe("DISABLED");
    }
  });

  it("permits only explicitly allowlisted fictional QA inboxes after security approval", () => {
    const env: NodeJS.ProcessEnv = {
      ...attested, SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED: "true",
      SERVICEDESK_OWNER_REGISTRATION_ENABLED: "false",
    };
    expect(ownerRegistrationMode(env)).toBe("QA_ONLY");
    expect(ownerRegistrationEmailAllowed("OWNER-A@example.test", env)).toBe(true);
    expect(ownerRegistrationEmailAllowed("owner-b@example.test", env)).toBe(true);
    expect(ownerRegistrationEmailAllowed("unknown@example.test", env)).toBe(false);
    expect(ownerRegistrationPubliclyAvailable(env)).toBe(false);
  });

  it("separately requires public rollout flag, verified HTTPS origin and public key", () => {
    const staged: NodeJS.ProcessEnv = {
      ...attested, SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED: "true",
    };
    expect(ownerRegistrationMode(staged)).toBe("QA_ONLY");
    const publicEnv = { ...staged, SERVICEDESK_OWNER_REGISTRATION_ENABLED: "true" };
    expect(ownerRegistrationMode(publicEnv)).toBe("PUBLIC");
    expect(ownerRegistrationEmailAllowed("new-owner@example.test", publicEnv)).toBe(true);
    expect(ownerRegistrationMode({ ...publicEnv, NEXT_PUBLIC_SUPABASE_URL: undefined }))
      .toBe("DISABLED");
    expect(ownerRegistrationMode({
      ...publicEnv, SERVICEDESK_AUTH_REDIRECT_ORIGIN: "http://unsafe.example.test",
    })).toBe("DISABLED");
  });
});
