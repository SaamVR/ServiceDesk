import {
  sampleConversation,
  sampleInvoice,
  sampleQuote,
  sampleRequest,
  sampleVisit,
} from "@/features/operations/sample-data";
import { CrmPreview } from "./CrmPreview";

export function CrmFixturePreview() {
  return (
    <CrmPreview
      request={sampleRequest}
      quote={sampleQuote}
      visit={sampleVisit}
      invoice={sampleInvoice}
      conversation={sampleConversation}
    />
  );
}
