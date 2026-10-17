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
    if(!integer(v[key],(key==="baseMinutes"||key==="baseMinor")?1:0,max))return false;
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
// Align with the server's PostgreSQL timestamptz requirement. Date.parse
// alone accepts local/date-only and silently normalizes February 30.
const instant=(value:unknown):number|null=>{
  if(typeof value!=="string")return null;
  const m=/^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.(\\d{1,6}))?(Z|[+-]\\d{2}:\\d{2})$/.exec(value);
  if(!m)return null;
  const [y,mo,d,h,mi,sec]=m.slice(1,7).map(Number);
  if(y<1||mo<1||mo>12||d<1||h>23||mi>59||sec>59||
     d>new Date(Date.UTC(y,mo,0)).getUTCDate())return null;
  const zone=m[8];
  if(zone!=="Z"){
    const zh=Number(zone.slice(1,3)),zm=Number(zone.slice(4,6));
    if(zh>14||zm>59||(zh===14&&zm!==0))return null;
  }
  const result=Date.parse(value);
  return Number.isFinite(result)?result:null;
};
const times=(book:RecordData):[number,number]|null=>{
  const start=book.starts_at==null?Number.NEGATIVE_INFINITY:instant(book.starts_at);
  const end=book.ends_at==null?Number.POSITIVE_INFINITY:instant(book.ends_at);
  if(start===null||end===null)return null;
  return [start,end];
};
const effective=(period:[number,number],now:number)=>
  period[0]<=now && period[1]>now && period[0]<period[1];

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
  const invalidBranches=new Set<string>();
  for(const book of input.books){
    if(!record(book)||!uuid(book.branch_id)||book.active!==true)continue;
    const id=book.branch_id,period=times(book);
    if(!period){invalidBranches.add(id);continue;}
    if(!effective(period,now))continue;
    byBranch.set(id,[...(byBranch.get(id)??[]),book]);
  }
  return [...byBranch].filter(([id,rows])=>!invalidBranches.has(id) && rows.length===1 &&
    uuid(rows[0].rate_card_id)&&validCards.has(rows[0].rate_card_id as string))
    .map(([id])=>id);
}
