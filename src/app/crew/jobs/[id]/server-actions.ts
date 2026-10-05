import type { ActorContext } from "@/contracts";
import type { ServiceDeskFacade, WorkspaceSnapshotQuery } from "@/server/core/facade";
import { createCrewTransitionServerActionFactory, type CrewTransitionActionInput } from "@/features/crew/server-boundary";
import {
  createCrewFieldServerActionFactory,
  type CrewChecklistCommandInput,
  type CrewEvidenceCommandInput,
} from "@/features/crew/field-server-boundary";

export function createCrewJobRouteBoundary(
  commands: Pick<ServiceDeskFacade, "readWorkspaceSnapshot" | "transitionVisit" | "addVisitEvidence" | "setVisitChecklistItem">,
) {
  const transitionCrewVisit = createCrewTransitionServerActionFactory(commands);
  const fieldCommands = createCrewFieldServerActionFactory(commands);

  return {
    readJobSnapshot(ctx: ActorContext, query: WorkspaceSnapshotQuery) {
      return commands.readWorkspaceSnapshot(ctx, query);
    },
    transitionVisit(input: CrewTransitionActionInput) {
      return transitionCrewVisit(input);
    },
    addEvidence(input: CrewEvidenceCommandInput) {
      return fieldCommands.addEvidence(input);
    },
    setChecklistItem(input: CrewChecklistCommandInput) {
      return fieldCommands.setChecklistItem(input);
    },
  };
}
