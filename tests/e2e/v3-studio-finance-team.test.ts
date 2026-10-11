import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("Studio OS trustworthy commercial and staff-account actions", () => {
  it("prevents repeated commercial submissions while maintaining real server actions", () => {
    const commercial = read("src/features/commercial/CommercialBillingWorkspace.tsx");
    expect(commercial.match(/<StaffSubmitButton\b/g)).toHaveLength(7);
    for (const pendingLabel of ["Recording review…","Retiring tax profile…","Saving tax draft…",
      "Creating invoice draft…","Updating line item…","Issuing invoice…","Recording payment…"]) {
      expect(commercial).toContain('pendingLabel="' + pendingLabel + '"');
    }
    expect(commercial).toContain("createCommercialBillingDraft");
    expect(commercial).toContain("finalizeCommercialBillingDraft");
    expect(commercial).toContain("applyOperationalManualPayment");
    expect(commercial).toContain("setCommercialBillingLineState");
  });
  it("gives invitation revocation pending state and clipboard failure recovery", () => {
    const source = read("src/features/settings/TeamInvitationManager.tsx");
    expect(source).toContain('pendingLabel="Revoking invitation…"');
    expect(source).toContain("setCopyError(true)");
    expect(source).toContain('role="alert"');
    expect(source).toContain("Select and copy the invitation path shown");
    expect(source).toContain("revokeTeamInvitationAction");
    expect(source).toContain("createTeamInvitationAction");
    expect(source).not.toContain("console.log");
  });
});
