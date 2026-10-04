import { sampleQuote, sampleRequest } from "@/features/operations/sample-data";
import { QuoteApprovalPreview } from "./QuoteApprovalPreview";

export function QuoteApprovalFixturePreview() {
  return (
    <QuoteApprovalPreview
      request={sampleRequest}
      currentQuote={sampleQuote}
      previousQuote={{
        ...sampleQuote,
        id: "quote_previous",
        version: 1,
        totalMinor: 31_000,
        depositMinor: 7_750,
        balanceMinor: 23_250,
        durationMinutes: 220,
      }}
    />
  );
}
