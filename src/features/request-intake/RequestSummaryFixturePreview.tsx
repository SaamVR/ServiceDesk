import { sampleQuote, sampleRequest } from "@/features/operations/sample-data";
import { RequestSummaryPreview } from "./RequestSummaryPreview";

export function RequestSummaryFixturePreview() {
  return (
    <RequestSummaryPreview
      request={sampleRequest}
      quote={sampleQuote}
      modeLabel="Fixture summary"
      actionSuffix="preview"
      actionTitle="Fixture preview only; ServiceDeskFacade.updateRequest is not integrated on this branch."
    />
  );
}
