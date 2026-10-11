import { inboxQueueHref, type InboxQueue } from "./inbox-triage";

export interface InboxThreadPosition {
  index: number;
  total: number;
  previousHref?: string;
  nextHref?: string;
}

/**
 * Presentation-only navigation across the currently visible, triaged and
 * searched conversation queue. Never links into another tenant or bypasses
 * queue restrictions. The server still authorizes every destination.
 */
export function inboxThreadPosition<T extends { id: string }>(
  visibleConversations: readonly T[],
  selectedId: string,
  queue: InboxQueue,
  search = "",
): InboxThreadPosition {
  const index = visibleConversations.findIndex((item) => item.id === selectedId);
  if (index < 0) return { index: 0, total: visibleConversations.length };
  const href = (offset: number) => inboxQueueHref(queue, visibleConversations[offset].id, search) + "#active-inbox-thread";
  return {
    index: index + 1,
    total: visibleConversations.length,
    previousHref: index > 0 ? href(index - 1) : undefined,
    nextHref: index < visibleConversations.length - 1 ? href(index + 1) : undefined,
  };
}
