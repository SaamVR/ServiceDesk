import { describe,expect,it } from "vitest";
import { invoiceQueueCounts,filterInvoiceQueue,invoiceQueueHref,invoiceFeedbackPrefix,normalizeInvoiceQueue,invoiceQueueOf } from "@/features/operations/invoice-collection-queue";
const invoices=[
 {id:"a",status:"SENT",balanceMinor:7000},
 {id:"b",status:"PAID",balanceMinor:0},
 {id:"c",status:"VOID",balanceMinor:5000},
 {id:"d",status:"DRAFT",balanceMinor:0},
 {id:"e",status:"PARTIALLY_PAID",balanceMinor:3000}
];
describe("real invoice collection filters",()=>{
 it("uses authoritative status rather than calling zero-balance drafts paid",()=>{
  expect(invoiceQueueOf(invoices[3])).toBe("other");
  expect(invoiceQueueCounts(invoices)).toEqual({all:5,open:2,paid:1,void:1,other:1});
  expect(filterInvoiceQueue(invoices,"open").map(x=>x.id)).toEqual(["a","e"]);
  expect(filterInvoiceQueue(invoices,"paid").map(x=>x.id)).toEqual(["b"]);
  expect(normalizeInvoiceQueue("unknown")).toBe("all");
 });
 it("preserves queue and customer search after mutation and navigation",()=>{
  expect(invoiceQueueHref("open","Walter Finch","a")).toBe("?queue=open&search=Walter+Finch&invoice=a");
  expect(invoiceFeedbackPrefix("open","Walter Finch","a")).toBe("queue=open&search=Walter+Finch&invoice=a&");
  expect(invoiceQueueHref("all","")).toBe("?");
 });
});
