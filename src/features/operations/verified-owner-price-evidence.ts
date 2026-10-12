/**
 * Owner pricing activation display must use actual saved, effective service
 * rates rather than equating a branch_price_books pointer with valid prices.
 * Never return monetary amounts or customer data to the browser.
 */
type RecordData = Record<string, unknown>;
const validUuid = (x:unknown) => typeof x==="string" &&
  /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(x);

export function verifiedPricedOwnerBranchIds(input: {
  books: RecordData[];
  cards: RecordData[];
  services: RecordData[];
  now?: number;
}): string[] {
  const now=input.now??Date.now();
  if (!Number.isFinite(now)) return [];
  const supported = new Set(input.services
    .filter(row=>validUuid(row.id) && row.active===true &&
      ["STANDARD","DEEP","MOVE_OUT"].includes(String(row.code)))
    .map(row=>String(row.code)));
  const mapping:{[code:string]:string}={
    STANDARD:"standard",DEEP:"deep",MOVE_OUT:"moveOut",
  };
  const activeCards=new Set(input.cards.filter(card=>{
    if(!validUuid(card.id) || card.active!==true ||
        typeof card.currency!=="string" || card.currency.trim()!=="USD" ||
        !card.rules || typeof card.rules!=="object" || Array.isArray(card.rules)) return false;
    const rules=card.rules as RecordData;
    return [...supported].some(code=>{
      const rule=rules[mapping[code]];
      if(!rule || typeof rule!=="object" || Array.isArray(rule))return false;
      const values=rule as RecordData;
      return typeof values.baseMinor==="number" &&
        Number.isSafeInteger(values.baseMinor) && values.baseMinor>0 &&
        typeof values.baseMinutes==="number" &&
        Number.isSafeInteger(values.baseMinutes) && values.baseMinutes>0;
    });
  }).map(card=>String(card.id)));
  const on=(value:unknown)=>
    value===null || value===undefined ? null :
    typeof value==="string" ? Date.parse(value) : NaN;
  return [...new Set(input.books.filter(book=>{
    if(!validUuid(book.branch_id) || !validUuid(book.rate_card_id) ||
       book.active!==true || !activeCards.has(String(book.rate_card_id))) return false;
    const start=on(book.starts_at), end=on(book.ends_at);
    return (start===null || Number.isFinite(start) && start<=now) &&
      (end===null || Number.isFinite(end) && end>now);
  }).map(row=>String(row.branch_id)))];
}
