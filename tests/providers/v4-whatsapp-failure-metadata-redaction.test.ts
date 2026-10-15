import { describe, expect, test } from "vitest";
import { normalizeWhatsAppFailureMetadata } from "../../src/server/integrations/whatsapp/status-failure";

describe("untrusted WhatsApp error evidence",()=>{
  test("redacts credentials, phone, email and invisible-control instructions in both title and details",()=>{
    const result=normalizeWhatsAppFailureMetadata({
      providerMessageId:"wamid.safe_012",phoneNumberId:"phone-012",
      providerTimestamp:"1791108300",errorCode:131026,
      errorTitle:"Bearer top-secret admin@example.com 15551234567\u202E invoice failed",
      errorDetails:"access_token=PRIVATE token:PRIVATE_OTHER user@example.test +15551234567",
      rawProviderEvent:"do-not-store user@example.test",
    });
    const serialized=JSON.stringify(result);
    for(const forbidden of ["top-secret","admin@example.com","15551234567",
      "PRIVATE","PRIVATE_OTHER","user@example.test","\u202E"])
      expect(serialized).not.toContain(forbidden);
    expect(result.providerMessageId).toBe("wamid.safe_012");
    expect(result.providerAccountId).toBe("phone-012");
    expect(result.rawPayloadIncluded).toBe(false);
  });
  test("bounds provider text and declines malformed opaque receipt identifiers",()=>{
    const result=normalizeWhatsAppFailureMetadata({
      providerMessageId:"bad provider token:SECRETCODE",
      phoneNumberId:"phone@example.com",
      providerTimestamp:"Bearer secret",
      errorCode:Number.POSITIVE_INFINITY,
      errorTitle:"X".repeat(2000),
      errorDetails:"Y".repeat(5000),
    });
    expect(result.providerMessageId).toBe("UNVERIFIED");
    expect(result.providerAccountId).toBe("UNVERIFIED");
    expect(result.providerTimestamp).toBe("UNVERIFIED");
    expect(result.errorCode).toBeUndefined();
    expect(result.errorTitle?.length).toBeLessThanOrEqual(180);
    expect(result.errorDetails?.length).toBeLessThanOrEqual(600);
  });
});
