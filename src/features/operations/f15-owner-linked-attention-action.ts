"use server";
import {readF15OwnerLinkedAttentionProof} from "@/server/workflows/sonic-f15-owner-linked-attention";
/** Explicit read-only owner-side check. No provider, workflow or SQL mutation. */
export async function requestF15LinkedAttentionProof(
 workspaceSlug:string,branchId:string,requestId:string,
){return readF15OwnerLinkedAttentionProof(workspaceSlug,branchId,requestId);}
