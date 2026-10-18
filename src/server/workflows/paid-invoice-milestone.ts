/** A PAID invoice is an authoritative milestone only if the saved ledger
 * reconciles. Do not trigger owner workflows from a mutated status flag.
 */
export function isVerifiedPaidInvoiceMilestone(row: Record<string, unknown>): boolean {
  if(!row || typeof row!=="object" || Array.isArray(row) ||
     ![Object.prototype,null].includes(Object.getPrototypeOf(row)) ||
     Object.getOwnPropertySymbols(row).length>0 ||
     Object.getOwnPropertyNames(row).length!==Object.keys(row).length)
     return false;
  const fields=["status","currency","total_minor","allocated_minor",
    "refunded_minor","balance_minor"];
  const allowed=new Set(["id","quote_id",...fields]);
  if(fields.some(field=>!Object.hasOwn(row,field)) ||
     Object.keys(row).some(field=>!allowed.has(field)) ||
     Object.values(Object.getOwnPropertyDescriptors(row))
       .some(descriptor=>!Object.hasOwn(descriptor,"value")))
    return false;
  const totals = [row.total_minor, row.allocated_minor, row.refunded_minor, row.balance_minor];
  return row.status === "PAID" &&
    totals.every(n => typeof n === "number" && Number.isSafeInteger(n) && n >= 0) &&
    (row.total_minor as number) > 0 &&
    row.balance_minor === 0 &&
    (row.allocated_minor as number) >= (row.refunded_minor as number) &&
    (row.allocated_minor as number) - (row.refunded_minor as number) === row.total_minor &&
    typeof row.currency === "string" && /^[A-Z]{3}$/.test(row.currency);
}
