import {handleAiWorkflowSuggestionPost} from "@/server/api-handlers/ai-workflow-suggestion-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request):Promise<Response> {
 return handleAiWorkflowSuggestionPost(request);
}
