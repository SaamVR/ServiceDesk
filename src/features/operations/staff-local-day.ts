/**
 * Business-local day conversion for dispatch, including DST and date boundaries.
 * Construct an Intl formatter once per rendered snapshot, not per visit.
 */
export function createLocalDayKey(timeZone: string): (timestamp: string) => string | undefined {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
    });
  } catch {
    // A malformed persisted business timezone is not an empty workday.
    // Signal uncertainty to the dashboard instead of crashing during SSR.
    return () => undefined;
  }
  return (timestamp) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return undefined;
    const parts = formatter.formatToParts(date);
    const part = (name: string) => parts.find((item) => item.type === name)?.value;
    const year = part("year"), month = part("month"), day = part("day");
    return year && month && day ? year + "-" + month + "-" + day : undefined;
  };
}
