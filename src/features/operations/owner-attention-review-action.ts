"use server";

import { loadOwnerAttentionSla } from "@/server/ai/owner-attention-sla";
import {
  projectOwnerAttentionReview,
  type OwnerAttentionReviewProjection,
} from "./owner-attention-review-projection";

const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const denied=():OwnerAttentionReviewProjection=>({
  ok:false,state:"ATTENTION_EVIDENCE_UNAVAILABLE",
});

/** Explicit opt-in READ ONLY. The upstream service double-checks saved rows,
 * owner JWT/membership, tenant, freshness, status, due clock and source
 * equality. No model, worker, retry, provider or payment API is invoked. */
export async function requestOwnerOverdueAttentionReview(
  workspaceSlug:string,
):Promise<OwnerAttentionReviewProjection>{
  if(typeof workspaceSlug!=="string" || workspaceSlug.length<3 ||
      workspaceSlug.length>40 || !slug.test(workspaceSlug))return denied();
  try{
    const source=await loadOwnerAttentionSla(workspaceSlug);
    return projectOwnerAttentionReview(source);
  }catch{return denied();}
}
