/**
 * Defense-in-depth for rendering the authenticated, read-only delivery
 * metadata endpoint. This module never handles message bodies, recipients,
 * provider credentials, retries, or mutation decisions.
 */
export type DeliveryTriageHealth = "OK" | "PENDING" | "NEEDS_REVIEW";
export type DeliveryTriageState =
  "QUEUED" | "RUNNING" | "PROVIDER_ACCEPTED" | "DELIVERED" |
  "READ" | "FAILED" | "SUPPRESSED" | "UNKNOWN";
export type DeliveryTriageReason =
  "PROVIDER_FAILURE" | "SUPPRESSED_BY_POLICY" | "STALE_PENDING" |
  "STATUS_MISSING" | "OUTBOX_RECEIPT_MISSING" | "OUTBOX_REFERENCE_MISSING";

export interface DeliveryDiagnostic {
  messageId: string;
  conversationId: string;
  channel: "WHATSAPP" | "EMAIL";
  deliveryState: DeliveryTriageState;
  health: DeliveryTriageHealth;
  ageMinutes: number;
  reason?: DeliveryTriageReason;
}
export interface InboxDeliveryDiagnosticsSnapshot {
  generatedAt: string;
  truncated: boolean;
  scannedOutboundMessages: number;
  counts: { ok: number; pending: number; review: number };
  items: DeliveryDiagnostic[];
}

const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const validHealth = new Set(["OK", "PENDING", "NEEDS_REVIEW"]);
const validState = new Set(["QUEUED", "RUNNING", "PROVIDER_ACCEPTED", "DELIVERED", "READ", "FAILED", "SUPPRESSED", "UNKNOWN"]);
const validReasons = new Set(["PROVIDER_FAILURE", "SUPPRESSED_BY_POLICY", "STALE_PENDING", "STATUS_MISSING", "OUTBOX_RECEIPT_MISSING", "OUTBOX_REFERENCE_MISSING"]);
const validCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 200;

export function parseInboxDeliveryDiagnostics(value: unknown): InboxDeliveryDiagnosticsSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.generatedAt !== "string" || !Number.isFinite(Date.parse(record.generatedAt)) ||
      typeof record.truncated !== "boolean" || !validCount(record.scannedOutboundMessages) ||
      !record.counts || typeof record.counts !== "object" || Array.isArray(record.counts) ||
      !Array.isArray(record.items) || record.items.length > 200) return undefined;
  const counts = record.counts as Record<string, unknown>;
  if (!validCount(counts.ok) || !validCount(counts.pending) || !validCount(counts.review) ||
      counts.ok + counts.pending + counts.review !== record.scannedOutboundMessages ||
      record.items.length !== record.scannedOutboundMessages) return undefined;
  const items: DeliveryDiagnostic[] = [];
  let ok = 0;
  let pending = 0;
  let review = 0;
  for (const input of record.items as unknown[]) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
    const item = input as Record<string, unknown>;
    if (!validId(item.messageId) || !validId(item.conversationId) ||
        (item.channel !== "WHATSAPP" && item.channel !== "EMAIL") ||
        typeof item.deliveryState !== "string" || !validState.has(item.deliveryState) ||
        typeof item.health !== "string" || !validHealth.has(item.health) ||
        !(typeof item.ageMinutes === "number" && Number.isSafeInteger(item.ageMinutes) && item.ageMinutes >= 0) ||
        (item.reason !== undefined && (typeof item.reason !== "string" || !validReasons.has(item.reason)))) {
      return undefined;
    }
    if (item.health === "OK") ok++;
    if (item.health === "PENDING") pending++;
    if (item.health === "NEEDS_REVIEW") review++;
    items.push({
      messageId: item.messageId,
      conversationId: item.conversationId,
      channel: item.channel,
      deliveryState: item.deliveryState as DeliveryTriageState,
      health: item.health as DeliveryTriageHealth,
      ageMinutes: item.ageMinutes as number,
      ...(item.reason ? { reason: item.reason as DeliveryTriageReason } : {}),
    });
  }
  if (ok !== counts.ok || pending !== counts.pending || review !== counts.review) return undefined;
  return {
    generatedAt: record.generatedAt,
    truncated: record.truncated,
    scannedOutboundMessages: record.scannedOutboundMessages,
    counts: { ok: ok, pending: pending, review: review },
    items,
  };
}

const reasonLabels: Record<DeliveryTriageReason, string> = {
  PROVIDER_FAILURE: "Provider failure",
  SUPPRESSED_BY_POLICY: "Suppressed by policy",
  STALE_PENDING: "Pending longer than expected",
  STATUS_MISSING: "No confirmed delivery status",
  OUTBOX_RECEIPT_MISSING: "Provider acceptance receipt missing",
  OUTBOX_REFERENCE_MISSING: "Outbox reference missing",
};

export function deliveryReviewLabel(reason?: DeliveryTriageReason): string {
  return reason ? reasonLabels[reason] : "Review provider evidence";
}
