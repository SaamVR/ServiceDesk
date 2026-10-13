export interface CustomerConsentChoice {
  id: string;
  channel: string;
  purpose: string;
  recordedAt: string;
}

/** One current customer choice per channel AND purpose. An email marketing
 * decision must never hide an independent transactional-email preference.
 * Saved records are authoritative; this read-only presentation never grants
 * new opt-in or infers delivery permission.
 */
export function latestCustomerConsentByPurpose<T extends CustomerConsentChoice>(
  saved: readonly T[],
): T[] {
  const choices = new Map<string,T>();
  for (const row of saved) {
    if (!row || !row.id || !row.channel || !row.purpose) continue;
    const key = JSON.stringify([row.channel,row.purpose]);
    const previous = choices.get(key);
    if (!previous) { choices.set(key,row); continue; }
    const nextTime = Date.parse(row.recordedAt);
    const prevTime = Date.parse(previous.recordedAt);
    if (Number.isFinite(nextTime) &&
        (!Number.isFinite(prevTime) || nextTime > prevTime)) {
      choices.set(key,row);
    }
  }
  return [...choices.values()].sort(
    (a,b)=>a.channel.localeCompare(b.channel) ||
      a.purpose.localeCompare(b.purpose),
  );
}
