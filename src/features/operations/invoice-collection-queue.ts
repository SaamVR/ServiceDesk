/** Read-only invoice queue filters. Never infer settlement from a zero balance. */
export const invoiceQueueOptions = [
  { key: "all", label: "All invoices" },
  { key: "open", label: "To collect" },
  { key: "paid", label: "Paid" },
  { key: "void", label: "Void" },
  { key: "other", label: "Other" },
] as const;
export type InvoiceQueue = typeof invoiceQueueOptions[number]["key"];
export type InvoiceCollectionRecord = { id: string; status: string; balanceMinor: number };
export function normalizeInvoiceQueue(input?: string | null): InvoiceQueue {
  return invoiceQueueOptions.find(x => x.key === input)?.key ?? "all";
}
export function invoiceQueueOf(invoice:InvoiceCollectionRecord):Exclude<InvoiceQueue,"all"> {
  if (invoice.status === "VOID") return "void";
  if (invoice.status === "PAID") return "paid";
  if (invoice.balanceMinor > 0) return "open";
  return "other";
}
export function invoiceQueueCounts(records:readonly InvoiceCollectionRecord[]):Record<InvoiceQueue,number> {
  const counts={all:records.length,open:0,paid:0,void:0,other:0};
  for(const record of records)counts[invoiceQueueOf(record)]++;
  return counts;
}
export function filterInvoiceQueue<T extends InvoiceCollectionRecord>(records:readonly T[],queue:InvoiceQueue):T[]{
  if(queue==="all")return [...records];
  return records.filter(x=>invoiceQueueOf(x)===queue);
}
export function invoiceQueueHref(queue:InvoiceQueue,search:string,id?:string):string {
  const qs=new URLSearchParams();
  if(queue!=="all")qs.set("queue",queue);
  if(search)qs.set("search",search.slice(0,100));
  if(id)qs.set("invoice",id);
  return "?"+qs.toString();
}
export function invoiceFeedbackPrefix(queue:InvoiceQueue,search:string,id:string):string {
  return invoiceQueueHref(queue,search,id).slice(1)+"&";
}
