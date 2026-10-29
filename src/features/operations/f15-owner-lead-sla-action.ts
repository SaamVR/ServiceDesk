"use server";
import {runF15OwnerManualEscalation} from "@/server/workflows/sonic-f15-owner-manual-escalation";
export async function requestF15OwnerLeadEscalation(
 workspaceSlug:string,branchId:string,requestId:string,
){return runF15OwnerManualEscalation(workspaceSlug,branchId,requestId);}
