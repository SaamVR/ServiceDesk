export function normalizeProviderTimestampToIso(value: string): string {
  const raw = value.trim();
  if (!raw) {
    throw new Error("PROVIDER_TIMESTAMP_INVALID: timestamp is required.");
  }

  let date: Date;
  if (/^\d+$/.test(raw)) {
    if (raw.length <= 10) {
      date = new Date(Number(raw) * 1000);
    } else if (raw.length === 13) {
      date = new Date(Number(raw));
    } else {
      throw new Error("PROVIDER_TIMESTAMP_INVALID: numeric timestamp must be Unix seconds or milliseconds.");
    }
  } else {
    date = new Date(raw);
  }

  const time = date.getTime();
  if (!Number.isFinite(time)) {
    throw new Error("PROVIDER_TIMESTAMP_INVALID: timestamp could not be parsed.");
  }

  return date.toISOString();
}
