import { sampleInvoice, sampleRequest, sampleVisit } from "@/features/operations/sample-data";
import { CrewJobPreview } from "./CrewJobPreview";

export function CrewJobFixturePreview() {
  return (
    <CrewJobPreview
      request={sampleRequest}
      visit={{ ...sampleVisit, status: "IN_PROGRESS" }}
      invoice={sampleInvoice}
    />
  );
}
