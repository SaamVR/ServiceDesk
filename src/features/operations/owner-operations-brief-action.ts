"use server";

import { generateOwnerOperationsBrief } from "@/server/ai/owner-operations-brief";
import type { OwnerOperationsBriefFacts } from "@/server/ai/owner-operations-brief";

type OwnerBriefActionResult =
  | {ok:true; brief:string; model:string; facts:OwnerOperationsBriefFacts; source:"AUTHORIZED_SAVED_WORKSPACE_COUNTS"}
  | {ok:false; message:string};

export async function requestOwnerOperationsBrief(
  workspaceSlug:string,
):Promise<OwnerBriefActionResult> {
  const result=await generateOwnerOperationsBrief(workspaceSlug);
  if(!result.ok) return {ok:false,message:
    "Owner AI briefing is unavailable or its saved source changed. Open the live operational queues instead; no action was taken."};
  // Only the existing server-verified seven aggregate counts cross this
  // owner-only response. Never return raw queue rows, money or identities.
  return {ok:true,brief:result.value.brief,model:result.value.model,
    source:result.value.source,facts:result.value.facts};
}
