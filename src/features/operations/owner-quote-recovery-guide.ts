import type { OwnerQuoteRecoverySummary } from "@/server/workflows/owner-quote-recovery-queue";

export interface SavedRecoveryReviewAction {
  id: "EXPIRED_LEASES" | "DEAD_LETTERS" | "DUE_EVENTS";
  count: number;
  title: string;
  description: string;
  level: "danger" | "warning" | "neutral";
}

/** Counts are acquired by independent source queries, not an atomic read.
 * Suppress mathematically inconsistent health projections instead of
 * presenting them as proof a queue is healthy or ready to retry.
 */
export function isConsistentOwnerRecoveryAggregate(
  source:OwnerQuoteRecoverySummary,
):source is Extract<OwnerQuoteRecoverySummary,{state:"AVAILABLE"}>{
  if(source.state!=="AVAILABLE")return false;
  const {counts,health}=source;
  if(!counts || !health)return false;
  for(const state of ["PENDING","PROCESSING","RETRY_PENDING","DEAD_LETTER",
    "SUCCEEDED","SKIPPED"] as const){
    if(!Number.isSafeInteger(counts[state]) || counts[state]<0)return false;
  }
  return Number.isSafeInteger(health.dueNow) && health.dueNow>=0 &&
    Number.isSafeInteger(health.expiredLeases) && health.expiredLeases>=0 &&
    health.dueNow<=counts.PENDING+counts.RETRY_PENDING &&
    health.expiredLeases<=counts.PROCESSING;
}

/** Read-only owner guidance from verified aggregate counts; never infer that
 * a worker is running or authorize a retry, customer send or financial action.
 * No individual event ID is available in this safe projection.
 */
export function summarizeOwnerRecoveryReview(
  source: OwnerQuoteRecoverySummary,
): SavedRecoveryReviewAction[] {
  if (!isConsistentOwnerRecoveryAggregate(source)) return [];
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
