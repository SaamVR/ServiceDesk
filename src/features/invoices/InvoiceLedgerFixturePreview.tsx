import { sampleInvoice } from "@/features/operations/sample-data";
import { InvoiceLedgerPreview } from "./InvoiceLedgerPreview";

export function InvoiceLedgerFixturePreview() {
  return <InvoiceLedgerPreview invoice={sampleInvoice} />;
}
