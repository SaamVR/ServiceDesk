import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { invoiceQueueCounts,filterInvoiceQueue,invoiceQueueHref,invoiceFeedbackPrefix,normalizeInvoiceQueue,invoiceQueueOf,isCollectibleInvoice,orderCustomerCollectionInvoices,parseManualPaymentAmountMinor } from "@/features/operations/invoice-collection-queue";
const invoices=[
 {id:"a",status:"ISSUED",balanceMinor:7000},
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
  expect(isCollectibleInvoice(invoices[0])).toBe(true);
  expect(isCollectibleInvoice(invoices[3])).toBe(false);
  expect(isCollectibleInvoice(invoices[4])).toBe(true);
  expect(isCollectibleInvoice(invoices[5])).toBe(false);
  expect(isCollectibleInvoice(invoices[6])).toBe(false);
  expect(isCollectibleInvoice({status:"ISSUED",balanceMinor:5100})).toBe(true);
  expect(isCollectibleInvoice({status:"SENT",balanceMinor:5100})).toBe(false);
  expect(isCollectibleInvoice({status:"DRAFT",balanceMinor:5100})).toBe(false);
  expect(isCollectibleInvoice({status:"ISSUED",balanceMinor:NaN})).toBe(false);
  const code=readFileSync(join(process.cwd(),"src/features/operations/OperationalProductRoute.tsx"),"utf8");
  expect(code).toContain("const selectedInvoiceCanRecordPayment = isCollectibleInvoice(selectedInvoice)");
  expect(code).toContain("const openInvoices = selectedInvoices.filter(isCollectibleInvoice)");
  expect(code).toContain("const openInvoices = orderedInvoices.filter(isCollectibleInvoice)");
  expect(code).toContain('Draft awaiting issue');
  expect(code).toContain('Not due until the invoice is issued');
 });
 it("parses positive exact minor units and rejects unsafe monetary input",()=>{
  expect(parseManualPaymentAmountMinor("1")).toBe(100);
  expect(parseManualPaymentAmountMinor("1.2")).toBe(120);
  expect(parseManualPaymentAmountMinor("1.23")).toBe(123);
  expect(parseManualPaymentAmountMinor(" 0.01 ")).toBe(1);
  expect(parseManualPaymentAmountMinor("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER);
  for(const invalid of ["", "  ", "0", "0.00", "-1", "+1", ".50", "1.234", "0.001",
    "1e3", "Infinity", "NaN", "1,000.00", "90071992547409.92", "9".repeat(100)]) {
    expect(parseManualPaymentAmountMinor(invalid),invalid).toBeUndefined();
  }
 });
 it("protects staff payment submission from rounded or unsafe decimal input",()=>{
  const code=readFileSync(join(process.cwd(),"src/features/operations/OperationalProductRoute.tsx"),"utf8");
  expect(code).toContain("parseManualPaymentAmountMinor(String(formData.get(\"amount\") ?? \"\"))");
  expect(code).toContain("if (amountMinor === undefined)");
  expect(code).toContain("applyOperationalManualPayment(workspaceSlug, invoiceId, amountMinor");
  expect(code).not.toContain("Number(match[1]) * 100");
 });
 it("sorts collections without comparing balances across different currencies",()=>{
  const source=[
    {id:"usd-low",status:"ISSUED",currency:"USD",balanceMinor:100},
    {id:"eur-high",status:"ISSUED",currency:"EUR",balanceMinor:300000},
    {id:"usd-high",status:"PARTIALLY_PAID",currency:"USD",balanceMinor:7500},
    {id:"draft",status:"DRAFT",currency:"USD",balanceMinor:1000000},
    {id:"paid",status:"PAID",currency:"USD",balanceMinor:0},
    {id:"void",status:"VOID",currency:"USD",balanceMinor:80000000},
  ];
  const order=orderCustomerCollectionInvoices(source);
  expect(order.map(item=>item.id)).toEqual(["eur-high","usd-high","usd-low","draft","paid","void"]);
  expect(source.map(item=>item.id)).toEqual(["usd-low","eur-high","usd-high","draft","paid","void"]);
  expect(orderCustomerCollectionInvoices([...source].reverse()).map(item=>item.id))
    .toEqual(order.map(item=>item.id));
  const route=readFileSync(join(process.cwd(),"src/features/operations/OperationalProductRoute.tsx"),"utf8");
  expect(route).toContain("orderCustomerCollectionInvoices(customerInvoices)");
  expect(route).toContain("Ordered by status and invoice currency");
  expect(route).not.toContain("right.balanceMinor - left.balanceMinor");
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
