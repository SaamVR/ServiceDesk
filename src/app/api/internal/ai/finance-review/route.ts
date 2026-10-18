import {handleOwnerFinanceReviewPost} from "@/server/api-handlers/ai-finance-review-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request):Promise<Response>{
 return handleOwnerFinanceReviewPost(request);
}
