import type { OwnerQuoteRecoverySummary } from "@/server/workflows/owner-quote-recovery-queue";

export interface SavedRecoveryReviewAction {
  id: "EXPIRED_LEASES" | "DEAD_LETTERS" | "DUE_EVENTS";
  count: number;
  title: string;
  description: string;
  level: "danger" | "warning" | "neutral";
}

/** Read-only owner guidance from verified aggregate counts; never infer that
 * a worker is running or authorize a retry, customer send or financial action.
 * No individual event ID is available in this safe projection.
 */
export function summarizeOwnerRecoveryReview(
  source: OwnerQuoteRecoverySummary,
): SavedRecoveryReviewAction[] {
  if (source.state !== "AVAILABLE") return [];
  const actions: SavedRecoveryReviewAction[] = [
    {
      id:"EXPIRED_LEASES", count:source.health.expiredLeases,
      title:"Investigate expired worker leases",
      description:"A saved claim expired. Review event and worker evidence before considering any retry.",
      level:"danger",
    },
    {
      id:"DEAD_LETTERS", count:source.counts.DEAD_LETTER,
      title:"Inspect dead-letter source events",
      description:"These persisted events need manual triage; no automatic replay is authorized.",
      level:"danger",
    },
    {
      id:"DUE_EVENTS", count:source.health.dueNow,
      title:"Review due source events",
      description:"Pending or retry-ready saved events are due. This does not prove a worker ran.",
      level:"warning",
    },
  ];
  return actions.filter(item =>
    Number.isSafeInteger(item.count) && item.count > 0);
}
