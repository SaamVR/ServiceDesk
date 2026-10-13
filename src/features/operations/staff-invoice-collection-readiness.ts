/** Saved invoice ledger is the only authoritative staff-collection amount.
 * An ISSUED flag with corrupt allocated/refunded totals is not payable.
 */
export interface StaffCollectibleLedger {
  status: unknown;
  currency: unknown;
  totalMinor: unknown;
  allocatedMinor: unknown;
  refundedMinor: unknown;
  balanceMinor: unknown;
}
export function isVerifiedStaffCollectibleInvoice(f: StaffCollectibleLedger): boolean {
  const amounts=[f.totalMinor,f.allocatedMinor,f.refundedMinor,f.balanceMinor];
  return ["ISSUED","PARTIALLY_PAID"].includes(String(f.status)) &&
    typeof f.currency==="string" && /^[A-Z]{3}$/.test(f.currency) &&
    amounts.every(n=>typeof n==="number" && Number.isSafeInteger(n) && n>=0) &&
    (f.totalMinor as number)>0 && (f.balanceMinor as number)>0 &&
    (f.allocatedMinor as number)>=(f.refundedMinor as number) &&
    (f.allocatedMinor as number)-(f.refundedMinor as number)+(f.balanceMinor as number)===f.totalMinor;
}
