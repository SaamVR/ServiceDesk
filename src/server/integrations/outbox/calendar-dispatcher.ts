import type { CommandMeta, Result } from "../../../contracts";
import type { CalendarAdapter } from "../types";
import { dispatchOutcomeBase, type CommittedOutboxDispatcher, type CommittedOutboxDispatchInput, type CommittedOutboxDispatchOutcome } from "./dispatch-port";
import { classifyProviderFailure } from "./failure-policy";
import { readCalendarVisitProjection } from "./calendar-visit-intent";

export class CalendarVisitCommittedOutboxDispatcher implements CommittedOutboxDispatcher {
  constructor(
    private readonly adapter: CalendarAdapter,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async dispatch(input: CommittedOutboxDispatchInput): Promise<Result<CommittedOutboxDispatchOutcome>> {
    if (input.job.channel !== "GOOGLE_CALENDAR" || input.expectedChannel !== "GOOGLE_CALENDAR") {
      return { ok: true, value: classifyProviderFailure({ job: input.job, code: "CHANNEL_MISMATCH", message: "Calendar dispatcher received a non-Google Calendar outbox job." }) };
    }

    const projection = readCalendarVisitProjection(input.job);
    if (!projection.ok) return { ok: true, value: classifyProviderFailure({ job: input.job, code: projection.code, message: projection.message }) };
    const value = projection.value;
    if (value.workspaceId !== input.job.workspaceId || value.idempotencyKey !== input.job.idempotencyKey) {
      return { ok: true, value: classifyProviderFailure({ job: input.job, code: "INVALID_PROVIDER_EVENT_MAPPING", message: "Calendar visit projection identity does not match outbox job." }) };
    }

    const meta: CommandMeta = { idempotencyKey: input.job.idempotencyKey, now: input.committedAt };
    const sent = value.action === "CANCEL"
      ? await this.adapter.cancel(value.visit, meta)
      : await this.adapter.createOrUpdate(value.visit);

    if (!sent.ok) return { ok: true, value: classifyProviderFailure({ job: input.job, code: sent.code, message: sent.message }) };

    return {
      ok: true,
      value: {
        ...dispatchOutcomeBase(input.job),
        outcome: "ACCEPTED",
        providerMessageId: sent.value.providerEventId,
        acceptedAt: this.now(),
        providerMode: sent.value.evidence.mode,
        evidence: {
          ...sent.value.evidence,
          notes: [
            ...sent.value.evidence.notes,
            "Google Calendar provider event ID is mapping/evidence only; ServiceDesk VisitDTO remains authoritative.",
          ],
        },
      },
    };
  }
}
