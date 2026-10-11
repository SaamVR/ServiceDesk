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
/** Only issued invoices with a positive balance can be presented as collectible.
 * Drafts are not bills sent to a customer, even when their calculated balance is
 * positive. The payment backend remains authoritative for all mutations.
 */
export function isCollectibleInvoice(invoice: Pick<InvoiceCollectionRecord, "status" | "balanceMinor">): boolean {
  return (invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID")
    && Number.isFinite(invoice.balanceMinor) && invoice.balanceMinor > 0;
}
export function invoiceQueueOf(invoice:InvoiceCollectionRecord):Exclude<InvoiceQueue,"all"> {
  if (invoice.status === "VOID") return "void";
  if (invoice.status === "PAID") return "paid";
  if (isCollectibleInvoice(invoice)) return "open";
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
/** Parse a human-entered two-decimal amount exactly in integer minor units.
 * Never round fractional cents, accept exponent notation or pass imprecise
 * Number values into the authorized payment command.
 */
export function parseManualPaymentAmountMinor(raw: string): number | undefined {
  const value = raw.trim();
  if (!value || value.length > 32) return undefined;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return undefined;
  const minor = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  if (minor <= 0n || minor > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  return Number(minor);
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
