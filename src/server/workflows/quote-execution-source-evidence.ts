import { workflowExecutionKey } from "./engine";

/**
 * Read-only, deterministic source proof for the existing live workflow schema.
 * SQL already persists execution_key; live keys bind workspace, branch,
 * event type, rule version, source quote and recursion depth. Reconstruct
 * the expected key from only authorized quote/request snapshot rows.
 *
 * A matching branch alone never proves which quote produced the execution.
 * This does not prove an independent customer session or a persisted
 * attention_items row; those need their own acceptance gates.
 */
export function matchingQuoteSourceForLiveExecution(input: {
  workspaceId: string;
  execution: {
    executionKey: unknown;
    mode: unknown;
    eventType: unknown;
    recursionDepth: unknown;
    ruleVersionId: unknown;
    branchId: unknown;
  };
  quoteSources: readonly { id: string; branchId: string }[];
}): string | undefined {
  const { execution, workspaceId } = input;
  const uuid = (value: unknown): value is string =>
    typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
  if (!uuid(workspaceId) || !uuid(execution.ruleVersionId) ||
      !uuid(execution.branchId) || execution.mode !== "LIVE" ||
      execution.eventType !== "QUOTE_ACCEPTED" ||
      execution.recursionDepth !== 0 ||
      typeof execution.executionKey !== "string" ||
      !/^live:[a-f0-9-]{36}:[a-f0-9]{64}$/.test(execution.executionKey) ||
      !Array.isArray(input.quoteSources) || input.quoteSources.length > 1000) return undefined;
  let matched: string | undefined;
  for (const quote of input.quoteSources) {
    if (!quote || !uuid(quote.id) || quote.branchId !== execution.branchId) continue;
    const key = workflowExecutionKey({
      mode: "LIVE", ruleVersionId: execution.ruleVersionId,
      eventFingerprint: "",
      sourceEvent: {
        workspaceId,
        branchId: execution.branchId,
        eventType: "QUOTE_ACCEPTED",
        sourceEventId: quote.id,
        recursionDepth: 0,
      },
    });
    if (key !== execution.executionKey) continue;
    // Defensive uniqueness: never return identity if inputs are ambiguous.
    if (matched) return undefined;
    matched = quote.id;
  }
  return matched;
}
