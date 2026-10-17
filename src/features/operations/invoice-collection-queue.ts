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
  // The invoice ledger represents exact integer minor units. A decimal or
  // unsafe IEEE-754 balance is not a collectible amount, even if finite.
  return (invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID")
    && Number.isSafeInteger(invoice.balanceMinor) && invoice.balanceMinor > 0;
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
/** Financial queue ordering is status-first and then currency-local.
 * Comparing minor units from different currencies exaggerates priority and is
 * not a meaningful money comparison. This only sorts an authorized snapshot.
 */
export function orderCustomerCollectionInvoices<T extends InvoiceCollectionRecord & { currency: string }>(
  records: readonly T[],
): T[] {
  const priority: Record<Exclude<InvoiceQueue, "all">, number> = {
    open: 0, other: 1, paid: 2, void: 3,
  };
  return [...records].sort((left, right) => {
    const group = priority[invoiceQueueOf(left)] - priority[invoiceQueueOf(right)];
    if (group) return group;
    const currency = left.currency.localeCompare(right.currency);
    if (currency) return currency;
    // Do not sort a fabricated fractional or unsafe currency value ahead
    // of any authoritative invoice within the same currency.
    const leftMinor = Number.isSafeInteger(left.balanceMinor) && left.balanceMinor >= 0 ? left.balanceMinor : 0;
    const rightMinor = Number.isSafeInteger(right.balanceMinor) && right.balanceMinor >= 0 ? right.balanceMinor : 0;
    return rightMinor - leftMinor || left.id.localeCompare(right.id);
  });
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
