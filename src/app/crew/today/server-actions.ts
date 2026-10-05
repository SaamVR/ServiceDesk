import type { ActorContext, CommandMeta } from "@/contracts";
import type { ServiceDeskFacade, WorkspaceSnapshotQuery } from "@/server/core/facade";
import {
  createCrewFieldReadFactory,
  type CrewFieldReadPort,
} from "@/features/crew/route-boundary";
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

export function createCrewTodayV2RouteBoundary(
  readPort: CrewFieldReadPort,
  commands: Pick<ServiceDeskFacade, "transitionVisit">,
) {
  const read = createCrewFieldReadFactory(readPort);
  const transitionCrewVisit = createCrewTransitionServerActionFactory(commands);

  return {
    loadToday(ctx: ActorContext, now: string) {
      return read.loadToday(ctx, now);
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
