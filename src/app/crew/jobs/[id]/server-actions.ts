import type { ActorContext } from "@/contracts";
import type { ServiceDeskFacade, WorkspaceSnapshotQuery } from "@/server/core/facade";
import { createCrewTransitionServerActionFactory, type CrewTransitionActionInput } from "@/features/crew/server-boundary";

export function createCrewJobRouteBoundary(commands: Pick<ServiceDeskFacade, "readWorkspaceSnapshot" | "transitionVisit">) {
  const transitionCrewVisit = createCrewTransitionServerActionFactory(commands);

  return {
    readJobSnapshot(ctx: ActorContext, query: WorkspaceSnapshotQuery) {
      return commands.readWorkspaceSnapshot(ctx, query);
    },
    transitionVisit(input: CrewTransitionActionInput) {
      return transitionCrewVisit(input);
    },
  };
}
