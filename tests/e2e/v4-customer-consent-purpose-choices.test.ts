import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { latestCustomerConsentByPurpose } from "../../src/features/operations/customer-consent-display";

const records=[
  { id:"email-old",channel:"EMAIL",purpose:"MARKETING",status:"GRANTED",
    recordedAt:"2026-08-01T00:00:00Z" },
  { id:"email-revoke",channel:"EMAIL",purpose:"MARKETING",status:"REVOKED",
    recordedAt:"2026-10-13T00:00:00Z" },
  { id:"email-billing",channel:"EMAIL",purpose:"TRANSACTIONAL",status:"GRANTED",
    recordedAt:"2026-09-30T00:00:00Z" },
  { id:"wa",channel:"WHATSAPP",purpose:"MARKETING",status:"REVOKED",
    recordedAt:"2026-10-01T00:00:00Z" },
];
describe("purpose-scoped customer communication choices",()=>{
  test("does not hide email transactional consent behind unrelated email marketing consent",()=>{
    const items=latestCustomerConsentByPurpose(records);
    expect(items).toHaveLength(3);
    expect(items.map(x=>x.id)).toContain("email-billing");
    expect(items.map(x=>x.id)).toContain("email-revoke");
    expect(items.map(x=>x.id)).not.toContain("email-old");
  });
  test("uses saved timestamps rather than array order or stale status",()=>{
    const items=latestCustomerConsentByPurpose([...records].reverse());
    expect(items.find(x=>x.purpose==="MARKETING"&&x.channel==="EMAIL")?.status)
      .toBe("REVOKED");
  });
  test("does not collapse separate same-channel purposes into a single customer action",()=>{
    const route=readFileSync(join(process.cwd(),"src/features/operations/CustomerProductRoute.tsx"),"utf8");
    expect(route).toContain("latestCustomerConsentByPurpose(data.consents)");
    expect(route).toContain("each communication channel and purpose");
    expect(route).not.toContain("seen.has(consent.channel)");
    expect(route).toContain('name="consentId"');
  });
});
