import { sampleInvoice, sampleQuote, sampleSlot, sampleVisit } from "@/features/operations/sample-data";
import { CheckoutPreview } from "./CheckoutPreview";

export function CheckoutFixturePreview() {
  return (
    <CheckoutPreview
      quote={{ ...sampleQuote, status: "ACCEPTED" }}
      slot={{ ...sampleSlot, availabilityFresh: true }}
      visit={{ ...sampleVisit, status: "AWAITING_PAYMENT" }}
      invoice={sampleInvoice}
      paymentMode="SANDBOX"
      holdExpiresAt="2026-10-04T06:30:00.000Z"
    />
  );
}
