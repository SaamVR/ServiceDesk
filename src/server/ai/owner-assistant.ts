import type { ActorContext, Result } from "../../contracts";

export const OWNER_METRICS = [
  "OPEN_REQUESTS",
  "UNANSWERED_CONVERSATIONS",
  "OVERDUE_INVOICES_MINOR",
  "CREW_CAPACITY_MINUTES",
  "BOOKED_SERVICE_MINUTES",
] as const;

export type OwnerMetricName = (typeof OWNER_METRICS)[number];

export interface OwnerMetricSnapshot {
  workspaceId: string;
  from: string;
  to: string;
  source: "CORE_METRICS";
  metrics: Partial<Record<OwnerMetricName, number>>;
}

export interface OwnerMetricExplanation {
  workspaceId: string;
  metric: OwnerMetricName;
  value: number;
  source: OwnerMetricSnapshot["source"];
  timeRange: {
    from: string;
    to: string;
  };
  explanation: string;
  readOnly: true;
}

function isOwnerMetricName(value: string): value is OwnerMetricName {
  return (OWNER_METRICS as readonly string[]).includes(value);
}

function metricExplanation(metric: OwnerMetricName, value: number): string {
  switch (metric) {
    case "OPEN_REQUESTS":
      return `There are ${value} open requests in the selected time range.`;
    case "UNANSWERED_CONVERSATIONS":
      return `There are ${value} unanswered conversations in the selected time range.`;
    case "OVERDUE_INVOICES_MINOR":
      return `The overdue invoice balance is ${value} minor currency units in the selected time range.`;
    case "CREW_CAPACITY_MINUTES":
      return `Crew capacity totals ${value} minutes in the selected time range.`;
    case "BOOKED_SERVICE_MINUTES":
      return `Booked service time totals ${value} minutes in the selected time range.`;
  }
}

export function explainOwnerMetric(
  ctx: ActorContext,
  snapshot: OwnerMetricSnapshot,
  requestedMetric: string,
): Result<OwnerMetricExplanation> {
  if (ctx.role !== "OWNER") {
    return {
      ok: false,
      code: "OWNER_ROLE_REQUIRED",
      message: "Owner intelligence is available only to an authorized workspace owner.",
    };
  }

  if (ctx.workspaceId !== snapshot.workspaceId) {
    return {
      ok: false,
      code: "WORKSPACE_MISMATCH",
      message: "Owner metric snapshot does not belong to the actor workspace.",
    };
  }

  if (!isOwnerMetricName(requestedMetric)) {
    return {
      ok: false,
      code: "UNKNOWN_METRIC",
      message: "Requested owner metric is not in the approved metric allowlist.",
    };
  }

  const value = snapshot.metrics[requestedMetric];
  if (value === undefined) {
    return {
      ok: false,
      code: "METRIC_NOT_AVAILABLE",
      message: "Approved metric is not present in the scoped source snapshot; no value was invented.",
    };
  }

  return {
    ok: true,
    value: {
      workspaceId: snapshot.workspaceId,
      metric: requestedMetric,
      value,
      source: snapshot.source,
      timeRange: {
        from: snapshot.from,
        to: snapshot.to,
      },
      explanation: metricExplanation(requestedMetric, value),
      readOnly: true,
    },
  };
}
