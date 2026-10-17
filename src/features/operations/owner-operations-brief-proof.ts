/**
 * Validation boundary for the read-only owner action result.
 * An HTTP/server-action success is not enough: require the precise saved
 * source and a bounded, plain-text suggestion. Never render arbitrary
 * error messages or unexpected provider fields from a response payload.
 */
export interface VerifiedOwnerBrief {
  source: "AUTHORIZED_SAVED_WORKSPACE_COUNTS";
  model: string;
  brief: string;
}

export function parseVerifiedOwnerBrief(value: unknown): VerifiedOwnerBrief | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.ok !== true ||
      record.source !== "AUTHORIZED_SAVED_WORKSPACE_COUNTS" ||
      typeof record.model !== "string" || !record.model.trim() ||
      record.model.length > 100 || /[\u0000-\u001f\u007f]/.test(record.model) ||
      typeof record.brief !== "string" || !record.brief.trim() ||
      record.brief.length > 900 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(record.brief)) return null;
  return {
    source: "AUTHORIZED_SAVED_WORKSPACE_COUNTS",
    model: record.model,
    brief: record.brief,
  };
}
