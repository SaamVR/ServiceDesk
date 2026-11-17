"use server";
import {acknowledgeF15OneSavedInternalAttention} from "@/server/workflows/sonic-f15-owner-acknowledge";
/** Manual owner approval of one uniquely open F15 internal task only.
 * Server chooses source IDs; browser never supplies attention/review IDs. */
export async function requestF15OwnerAcknowledge(
 workspaceSlug:string,branchId:string,requestId:string,
){return acknowledgeF15OneSavedInternalAttention(workspaceSlug,branchId,requestId);}
