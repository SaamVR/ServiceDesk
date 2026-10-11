import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { invoiceQueueCounts,filterInvoiceQueue,invoiceQueueHref,invoiceFeedbackPrefix,normalizeInvoiceQueue,invoiceQueueOf,isCollectibleInvoice } from "@/features/operations/invoice-collection-queue";
const invoices=[
 {id:"a",status:"SENT",balanceMinor:7000},
 {id:"b",status:"PAID",balanceMinor:0},
 {id:"c",status:"VOID",balanceMinor:5000},
 {id:"d",status:"DRAFT",balanceMinor:0},
 {id:"e",status:"PARTIALLY_PAID",balanceMinor:3000},
 {id:"f",status:"DRAFT",balanceMinor:8500},
 {id:"g",status:"ISSUED",balanceMinor:0}
];
describe("real invoice collection filters",()=>{
 it("uses authoritative status rather than calling zero-balance drafts paid",()=>{
  expect(invoiceQueueOf(invoices[3])).toBe("other");
  expect(invoiceQueueCounts(invoices)).toEqual({all:7,open:2,paid:1,void:1,other:3});
  expect(filterInvoiceQueue(invoices,"open").map(x=>x.id)).toEqual(["a","e"]);
  expect(filterInvoiceQueue(invoices,"paid").map(x=>x.id)).toEqual(["b"]);
  expect(normalizeInvoiceQueue("unknown")).toBe("all");
 });
 it("never presents draft invoice balances as collectible or enables payment actions",()=>{
  expect(isCollectibleInvoice(invoices[0])).toBe(false); // SENT is not an authoritative invoice status
  expect(isCollectibleInvoice(invoices[3])).toBe(false);
  expect(isCollectibleInvoice(invoices[4])).toBe(true);
  expect(isCollectibleInvoice(invoices[5])).toBe(false);
  expect(isCollectibleInvoice(invoices[6])).toBe(false);
  expect(isCollectibleInvoice({id:"i",status:"ISSUED",balanceMinor:5100})).toBe(true);
  expect(isCollectibleInvoice({id:"i",status:"DRAFT",balanceMinor:5100})).toBe(false);
  expect(isCollectibleInvoice({id:"i",status:"ISSUED",balanceMinor:NaN})).toBe(false);
  const code=readFileSync(join(process.cwd(),"src/features/operations/OperationalProductRoute.tsx"),"utf8");
  expect(code).toContain("const selectedInvoiceCanRecordPayment = isCollectibleInvoice(selectedInvoice)");
  expect(code).toContain("const openInvoices = selectedInvoices.filter(isCollectibleInvoice)");
  expect(code).toContain("const openInvoices = orderedInvoices.filter(isCollectibleInvoice)");
  expect(code).toContain('Draft awaiting issue');
  expect(code).toContain('Not due until the invoice is issued');
 });
 it("preserves queue and customer search after mutation and navigation",()=>{
  expect(invoiceQueueHref("open","Walter Finch","a")).toBe("?queue=open&search=Walter+Finch&invoice=a");
  expect(invoiceFeedbackPrefix("open","Walter Finch","a")).toBe("queue=open&search=Walter+Finch&invoice=a&");
  expect(invoiceQueueHref("all","")).toBe("?");
 });
 it("wires real invoice search and collection links into authorized staff routing",()=>{
  const code=readFileSync(join(process.cwd(),"src/features/operations/OperationalProductRoute.tsx"),"utf8");
  expect(code).toContain("filterInvoiceQueue(orderedInvoices, queue)");
  expect(code).toContain("invoiceFeedbackPrefix(queue, search, invoiceId)");
  expect(code).toContain("invoiceQueueHref(queue, search, invoice.id)");
  expect(code).toContain("InvoiceCollectionFilters queue={queue}");
 });
});
