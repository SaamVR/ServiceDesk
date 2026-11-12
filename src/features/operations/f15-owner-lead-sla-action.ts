"use server";
import {runF15OwnerManualEscalation} from "@/server/workflows/sonic-f15-owner-manual-escalation";
import {readF15OwnerSavedReviewEvidence} from "@/server/workflows/sonic-f15-owner-review-evidence";
export async function requestF15OwnerLeadEscalation(
 workspaceSlug:string,branchId:string,requestId:string,
){return runF15OwnerManualEscalation(workspaceSlug,branchId,requestId);}

export async function requestF15OwnerReviewEvidence(
 workspaceSlug:string,branchId:string,requestId:string,
){return readF15OwnerSavedReviewEvidence(workspaceSlug,branchId,requestId);}
