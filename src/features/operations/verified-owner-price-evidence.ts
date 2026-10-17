/** Owner onboarding evidence must be at least as strict as the actual
 * server quote-rate parser. An active book pointer plus one base rate is NOT
 * proof a saved customer quote can be calculated. Monetary values stay on
 * the server; only authorized branch IDs are returned to the owner UI.
 */
type RecordData = Record<string, unknown>;
const uuid = (v: unknown): v is string => typeof v === "string" &&
  /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(v);
const record=(v: unknown):v is RecordData=>v!==null && typeof v==="object" && !Array.isArray(v);
const integer=(v:unknown,min:number,max:number):v is number=>
  typeof v==="number" && Number.isSafeInteger(v) && v>=min && v<=max;
const validRule=(v:unknown,ovenRequired=false):boolean=>{
  if(!record(v))return false;
  for(const key of ["baseMinor","baseMinutes","bedroomMinor","bedroomMinutes","bathroomMinor","bathroomMinutes"]){
    const max=key.endsWith("Minutes")?1440:10_000_000;
    if(!integer(v[key],key==="baseMinutes"?1:0,max))return false;
  }
  if((v.ovenMinor===undefined)!==(v.ovenMinutes===undefined))return false;
  if(ovenRequired && (v.ovenMinor===undefined||v.ovenMinutes===undefined))return false;
  return (v.ovenMinor===undefined || integer(v.ovenMinor,0,10_000_000)) &&
    (v.ovenMinutes===undefined || integer(v.ovenMinutes,0,1440));
};
const completeUsdCard=(card:RecordData):boolean=>{
  if(!uuid(card.id)||card.active!==true||card.currency!=="USD"||
      typeof card.version!=="string"||card.version.length<1||card.version.length>80||
      card.version==="synthetic-cleaning-v1"||
      !integer(card.deposit_percent,0,100)||!integer(card.valid_hours,1,720)||
      !integer(card.buffer_minutes,0,1440)||!record(card.rules))return false;
  const rules=card.rules;
  return integer(rules.autoApprovalMaxTotalMinor,0,100_000_000)&&
    validRule(rules.standard)&&validRule(rules.deep)&&validRule(rules.moveOut,true);
};
const effective=(book:RecordData, now:number):boolean=>{
  const on=(value:unknown):number|null=>value==null?null:
    typeof value==="string"&&value.length>0?Date.parse(value):NaN;
  const start=on(book.starts_at),end=on(book.ends_at);
  return (start===null||(Number.isFinite(start)&&start<=now))&&
    (end===null||(Number.isFinite(end)&&end>now));
};

export function verifiedPricedOwnerBranchIds(input:{
  books:RecordData[];cards:RecordData[];services:RecordData[];now?:number;
}):string[]{
  const now=input.now??Date.now();
  if(!Number.isFinite(now)||!Array.isArray(input.books)||
     !Array.isArray(input.cards)||!Array.isArray(input.services))return [];
  // At least one supported, actually saved service must be active; a card
  // alone does not make a real request with a selectable cleaning service.
  const hasService=input.services.some(row=>
    uuid(row.id)&&row.active===true&&
    ["STANDARD","DEEP","MOVE_OUT"].includes(row.code as string));
  if(!hasService)return [];
  const validCards=new Set(input.cards.filter(completeUsdCard).map(card=>String(card.id)));
  // Server quote calculation rejects ambiguous overlapping effective books.
  // Count EVERY effective active book, not merely the individually valid ones.
  const byBranch=new Map<string,RecordData[]>();
  for(const book of input.books){
    if(!record(book)||!uuid(book.branch_id)||book.active!==true||!effective(book,now))continue;
    const id=book.branch_id;
    byBranch.set(id,[...(byBranch.get(id)??[]),book]);
  }
  return [...byBranch].filter(([,rows])=>rows.length===1 &&
    uuid(rows[0].rate_card_id)&&validCards.has(rows[0].rate_card_id as string))
    .map(([id])=>id);
}
