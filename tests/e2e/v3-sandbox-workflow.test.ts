import { describe, expect, it } from "vitest";
import {
  createSandboxState,
  sandboxAllocatedMinor,
  sandboxOutstandingMinor,
  sandboxQuote,
  sandboxReducer,
  sandboxStages,
  type SandboxState,
} from "@/features/sandbox/sandbox-engine";

const actions = sandboxStages.flatMap(stage => stage.action ? [stage.action] : []);

function complete(): SandboxState {
  return actions.reduce<SandboxState>((state, action) => sandboxReducer(state, action), createSandboxState());
}

describe("interactive client-only ServiceDesk sandbox", () => {
  it("uses the production domain pricing function, not a second source of price truth", () => {
    expect(sandboxQuote).toMatchObject({
      totalMinor: 34_000,
      depositMinor: 8_500,
      balanceMinor: 25_500,
      durationMinutes: 240,
      bufferMinutes: 30,
    });
  });

  it("replays the full enquiry-to-paid-job lifecycle with conserved amounts", () => {
    const state = complete();
    expect(state.stage).toBe("BALANCE_PAID");
    expect(state.depositAllocatedMinor).toBe(8_500);
    expect(state.balanceAllocatedMinor).toBe(25_500);
    expect(sandboxAllocatedMinor(state)).toBe(34_000);
    expect(sandboxOutstandingMinor(state)).toBe(0);
    expect(state.events).toHaveLength(9);
    expect(new Set(state.events.map(event => event.id)).size).toBe(state.events.length);
  });

  it("never lets premature or repeated actions advance stage or double-allocate payments", () => {
    const initial = createSandboxState();
    expect(sandboxReducer(initial, "PAY_BALANCE").stage).toBe("ENQUIRY");
    const paid = complete();
    const attemptedDuplicate = sandboxReducer(paid, "PAY_DEPOSIT");
    expect(attemptedDuplicate.stage).toBe("BALANCE_PAID");
    expect(sandboxAllocatedMinor(attemptedDuplicate)).toBe(sandboxQuote.totalMinor);
    expect(attemptedDuplicate.events).toHaveLength(paid.events.length);
  });

  it("keeps simulated transport acceptance separate from delivered/read proof", () => {
    const start = createSandboxState();
    expect(sandboxReducer(start, "QUEUE_CONFIRMATION").delivery).toBe("UNSENT");
    const deposited = actions.slice(0, 4).reduce<SandboxState>((s, a) => sandboxReducer(s, a), start);
    expect(deposited.stage).toBe("DEPOSIT_PAID");
    const queued = sandboxReducer(deposited, "QUEUE_CONFIRMATION");
    expect(queued.delivery).toBe("QUEUED");
    expect(sandboxReducer(queued, "QUEUE_CONFIRMATION").events).toHaveLength(queued.events.length);
    const failed = sandboxReducer(queued, "FAIL_DELIVERY");
    expect(failed.delivery).toBe("FAILED");
    expect(sandboxReducer(failed, "ACKNOWLEDGE_DELIVERY").delivery).toBe("FAILED");
    const retried = sandboxReducer(failed, "RETRY_DELIVERY");
    expect(retried.delivery).toBe("QUEUED");
    const accepted = sandboxReducer(retried, "ACKNOWLEDGE_DELIVERY");
    expect(accepted.delivery).toBe("SIMULATED_PROVIDER_ACCEPTED");
    expect(accepted.notice).toContain("not customer delivery");
  });

  it("reset restores a blank, isolated simulation without stored or network state", () => {
    expect(sandboxReducer(complete(), "RESET")).toEqual(createSandboxState());
  });
});
