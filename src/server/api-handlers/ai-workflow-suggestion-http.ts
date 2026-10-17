import type {Result} from "../../contracts";
import {readBoundedWebhookBody} from "./inbound-http-policy";
import {suggestAuthorizedOwnerWorkflow,
  type AiWorkflowSuggestionInput,type AiWorkflowSuggestionResult} from "../ai/authorized-workflow-suggestion";

type Runner=(input:AiWorkflowSuggestionInput,signal?:AbortSignal)=>Promise<Result<AiWorkflowSuggestionResult>>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function response(status:number,data:unknown):Response {
 return Response.json(data,{status,headers:{
  "Cache-Control":"private, no-store","Vary":"Cookie",
  "X-Content-Type-Options":"nosniff",
 }});
}
function sameOrigin(request:Request):boolean {
 const origin=request.headers.get("origin");
 if(!origin)return false;
 let own:URL,browser:URL;
 try{own=new URL(request.url);browser=new URL(origin);}catch{return false;}
 if(origin!==browser.origin)return false;
 const site=request.headers.get("sec-fetch-site");
 if(site && !["same-origin","none"].includes(site))return false;
 const allowed=process.env.SERVICEDESK_AI_ALLOWED_ORIGIN;
 if(browser.origin===own.origin)return true;
 if(allowed) {
  try{
   const publicOrigin=new URL(allowed);
   if(publicOrigin.protocol==="https:" && publicOrigin.pathname==="/" &&
     !publicOrigin.username && !publicOrigin.password && !publicOrigin.port &&
     !publicOrigin.search && !publicOrigin.hash && publicOrigin.origin===browser.origin)return true;
  }catch{/* Invalid config does not grant access. */}
 }
 // Same trusted local dev exception used in the other internal AI endpoints.
 const local=(host:string)=>host==="127.0.0.1"||host==="localhost";
 return own.protocol==="http:" && browser.protocol==="http:" &&
    local(own.hostname)&&local(browser.hostname)&&
    own.port==="3000"&&browser.port==="3000"&&
    request.headers.get("host")===browser.host;
}
/** Owner-session, same-origin, bounded and never customer-actioning. */
export async function handleAiWorkflowSuggestionPost(
 request:Request,
 runner:Runner=(input,signal)=>suggestAuthorizedOwnerWorkflow(input,{signal}),
):Promise<Response>{
 if(request.method!=="POST")return response(405,{code:"METHOD_NOT_ALLOWED"});
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")??""))
   return response(415,{code:"CONTENT_TYPE_REQUIRED"});
 if(!sameOrigin(request))return response(403,{code:"SAME_ORIGIN_REQUIRED"});
 let bounded:Awaited<ReturnType<typeof readBoundedWebhookBody>>;
 try{bounded=await readBoundedWebhookBody(request,1024);}
 catch{return response(400,{code:"REQUEST_BODY_INVALID"});}
 if(!bounded.ok)return response(413,{code:"REQUEST_TOO_LARGE"});
 let parsed:unknown;
 try{parsed=JSON.parse(bounded.rawBody);}catch{return response(400,{code:"REQUEST_JSON_INVALID"});}
 if(!parsed || typeof parsed!=="object" || Array.isArray(parsed))
    return response(400,{code:"REQUEST_SCHEMA_INVALID"});
 const fields=parsed as Record<string,unknown>;
 if(Object.keys(fields).length!==3 ||
   Object.keys(fields).some(key=>!["workspaceSlug","branchId","instruction"].includes(key)) ||
   typeof fields.workspaceSlug!=="string" ||
   fields.workspaceSlug.length<3 || fields.workspaceSlug.length>40 ||
   !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.workspaceSlug) ||
   typeof fields.branchId!=="string" || !uuid.test(fields.branchId) ||
   typeof fields.instruction!=="string" ||
   fields.instruction.length<10 || fields.instruction.length>240)
   return response(400,{code:"REQUEST_SCHEMA_INVALID"});
 let result:Result<AiWorkflowSuggestionResult>;
 try{result=await runner({workspaceSlug:fields.workspaceSlug,
   branchId:fields.branchId,instruction:fields.instruction},request.signal);}
 catch{return response(503,{code:"AI_RULE_UNAVAILABLE"});}
 if(!result.ok){
   const status=["AI_RULE_OWNER_REQUIRED"].includes(result.code)?403:
     ["AI_RULE_AUTH_UNAVAILABLE","AI_RULE_ACCESS_REVOKED"].includes(result.code)?401:
     result.code==="AI_RULE_INPUT_INVALID"?400:
     ["AI_RULE_BRANCH_UNVERIFIED","AI_RULE_BRANCH_CHANGED"].includes(result.code)?404:
     result.code==="AI_RULE_CANCELLED"?499:503;
   return response(status,{code:result.code});
 }
 return response(200,result.value);
}
