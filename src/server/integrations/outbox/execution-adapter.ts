import type { ClaimedOutboxEvent, OutboxExecutionOutcome, OutboxExecutionPort } from "../../../contracts/outbox";
import type { Result } from "../../../contracts";
import { dispatchCommittedOutboxJob, type DispatchRouterTable } from "./dispatch-router";
import type { CommittedOutboxDispatchOutcome } from "./dispatch-port";
import { validateResolvedOutboxJob, type OutboxDeliveryIntentResolver } from "./intent-resolver";

export interface ConnectorOutboxExecutionPortOptions {
  resolver: OutboxDeliveryIntentResolver;
  dispatchers: DispatchRouterTable;
  now?: () => string;
}

function terminal(code: string, at: string): Result<OutboxExecutionOutcome> {
  return { ok: true, value: { outcome: "TERMINAL_FAILURE", failedAt: at, code } };
}

export function mapCommittedDispatchToExecutionOutcome(outcome: CommittedOutboxDispatchOutcome, now: () => string): OutboxExecutionOutcome {
  if (outcome.outcome === "ACCEPTED") {
    return { outcome: "SENT", completedAt: outcome.acceptedAt, providerReference: outcome.providerMessageId };
  }
  if (outcome.outcome === "RETRYABLE_FAILURE") {
    return { outcome: "RETRYABLE_FAILURE", failedAt: now(), code: outcome.code, retryAfterSeconds: outcome.retryAfterSeconds };
  }
  if (outcome.outcome === "SUPPRESSED") {
    return { outcome: "SUPPRESSED", failedAt: now(), code: outcome.code };
  }
  return { outcome: "TERMINAL_FAILURE", failedAt: now(), code: outcome.code };
}

export class ConnectorOutboxExecutionPort implements OutboxExecutionPort {
  private readonly now: () => string;

  constructor(private readonly options: ConnectorOutboxExecutionPortOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async execute(event: ClaimedOutboxEvent): Promise<Result<OutboxExecutionOutcome>> {
    const resolved = await this.options.resolver.resolve(event);
    if (!resolved.ok) return terminal(resolved.code || "OUTBOX_INTENT_RESOLUTION_FAILED", this.now());

    const validated = validateResolvedOutboxJob(event, resolved.value);
    if (!validated.ok) return terminal(validated.code, this.now());

    const dispatched = await dispatchCommittedOutboxJob({
      job: validated.value,
      committedAt: event.claimedAt,
      attempt: event.attempt,
      expectedWorkspaceId: event.workspaceId,
      dispatchers: this.options.dispatchers,
    });

    if (!dispatched.ok) return { ok: false, code: dispatched.code, message: dispatched.message };
    return { ok: true, value: mapCommittedDispatchToExecutionOutcome(dispatched.value, this.now) };
  }
}
