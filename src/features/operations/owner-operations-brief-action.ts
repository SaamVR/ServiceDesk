"use server";

import { generateOwnerOperationsBrief } from "@/server/ai/owner-operations-brief";
import type { OwnerPriorityAction } from "@/server/ai/owner-priority-actions";

type OwnerBriefActionResult =
  | {ok:true; brief:string; model:string; priorityActions:OwnerPriorityAction[]; source:"AUTHORIZED_SAVED_WORKSPACE_COUNTS"}
  | {ok:false; message:string};

export async function requestOwnerOperationsBrief(
  workspaceSlug:string,
):Promise<OwnerBriefActionResult> {
  const result=await generateOwnerOperationsBrief(workspaceSlug);
  if(!result.ok) return {ok:false,message:
    "Owner AI briefing is unavailable or its saved source changed. Open the live operational queues instead; no action was taken."};
  return {ok:true,brief:result.value.brief,model:result.value.model,
    priorityActions:result.value.priorityActions,source:result.value.source};
}
