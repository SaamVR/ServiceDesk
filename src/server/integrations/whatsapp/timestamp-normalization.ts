const RFC3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/;
function invalid(): never { throw new Error("PROVIDER_TIMESTAMP_INVALID: timestamp requires an exact Unix value or timezone-bound calendar instant."); }

/** Exact provider chronology: no Date.parse local-time guesses or rollover
 * of impossible civil dates. This function does not prove provider delivery. */
export function normalizeProviderTimestampToIso(value: string): string {
  if (typeof value !== "string" || !value || value.trim() !== value) invalid();
  let epoch: number;
  if (/^\d+$/.test(value)) {
    if (!/^(?:\d{1,10}|\d{13})$/.test(value)) invalid();
    epoch = Number(value) * (value.length === 13 ? 1 : 1000);
  } else {
    const match = RFC3339.exec(value);
    if (!match) invalid();
    const [,y,m,d,h,minute,sec,fraction,zone] = match!;
    const year=Number(y),month=Number(m),day=Number(d),hour=Number(h);
    const minuteN=Number(minute),second=Number(sec);
    const leap=year%4===0&&(year%100!==0||year%400===0);
    const monthDays=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
    if (year<1 || month<1 || month>12 || day<1 || day>monthDays[month-1] ||
        hour>23 || minuteN>59 || second>59) invalid();
    if (zone !== "Z") {
      const hours=Number(zone.slice(1,3)),minutes=Number(zone.slice(4,6));
      if(hours>14 || minutes>59 || (hours===14&&minutes!==0)) invalid();
    }
    const iso=value.slice(0,19)+(fraction?"."+fraction.padEnd(3,"0").slice(0,3):"")+zone;
    epoch=Date.parse(iso);
  }
  if(!Number.isFinite(epoch)) invalid();
  const date=new Date(epoch);
  if(!Number.isFinite(date.getTime())) invalid();
  return date.toISOString();
}
