import type { ActorContext, CommandMeta } from "@/contracts";
import type { ServiceDeskFacade, WorkspaceSnapshotQuery } from "@/server/core/facade";
import { createCrewTransitionServerActionFactory, type CrewTransitionActionInput } from "@/features/crew/server-boundary";

export function createCrewTodayRouteBoundary(commands: Pick<ServiceDeskFacade, "readWorkspaceSnapshot" | "transitionVisit">) {
  const transitionCrewVisit = createCrewTransitionServerActionFactory(commands);

  return {
    readTodaySnapshot(ctx: ActorContext, query: WorkspaceSnapshotQuery) {
      return commands.readWorkspaceSnapshot(ctx, query);
    },
    transitionVisit(input: CrewTransitionActionInput) {
      return transitionCrewVisit(input);
    },
  };
}

export function buildCrewTransitionMeta(input: { idempotencyKey: string; expectedVersion: number; now: string }): CommandMeta {
  return {
    idempotencyKey: input.idempotencyKey,
    expectedVersion: input.expectedVersion,
    now: input.now,
  };
}
