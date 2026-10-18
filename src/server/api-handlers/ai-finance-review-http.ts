import {readBoundedWebhookBody} from "./inbound-http-policy";
import {loadAuthorizedOwnerFinanceReview,
 type AuthorizedFinanceReviewResult} from "../ai/authorized-finance-review";

type Runner=(slug:string)=>Promise<AuthorizedFinanceReviewResult>;
function json(status:number,value:unknown):Response {
 return Response.json(value,{status,headers:{
  "Cache-Control":"private, no-store","Vary":"Cookie",
  "X-Content-Type-Options":"nosniff",
 }});
}
function allowedBrowserOrigin(request:Request):boolean {
 const origin=request.headers.get("origin");
 if(!origin)return false;
 let own:URL,caller:URL;
 try{own=new URL(request.url);caller=new URL(origin);}catch{return false;}
 if(caller.origin!==origin)return false;
 const fetchSite=request.headers.get("sec-fetch-site");
 if(fetchSite && !["same-origin","none"].includes(fetchSite))return false;
 if(own.origin===origin)return true;
 const configured=process.env.SERVICEDESK_AI_ALLOWED_ORIGIN;
 if(configured){
  try{
   const conf=new URL(configured);
   if(conf.protocol==="https:" && conf.pathname==="/" &&
     !conf.port&&!conf.username&&!conf.password&&!conf.search&&!conf.hash &&
     conf.origin===origin)return true;
  }catch{/* invalid config never grants access */}
 }
 const local=(host:string)=>host==="localhost"||host==="127.0.0.1";
 return own.protocol==="http:"&&caller.protocol==="http:"&&
   own.port==="3000"&&caller.port==="3000"&&
   local(own.hostname)&&local(caller.hostname)&&
   request.headers.get("host")===caller.host;
}

/** Owner-only, saved-ledger-only, same-origin API. No generative model,
 * payment application, refunds, recipient messages or automation effects. */
export async function handleOwnerFinanceReviewPost(
 request:Request,
 run:Runner=loadAuthorizedOwnerFinanceReview,
):Promise<Response>{
 if(request.method!=="POST")return json(405,{code:"METHOD_NOT_ALLOWED"});
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")??""))
   return json(415,{code:"CONTENT_TYPE_REQUIRED"});
 if(!allowedBrowserOrigin(request))return json(403,{code:"SAME_ORIGIN_REQUIRED"});
 let bounded:Awaited<ReturnType<typeof readBoundedWebhookBody>>;
 try{bounded=await readBoundedWebhookBody(request,512);}
 catch{return json(400,{code:"REQUEST_BODY_INVALID"});}
 if(!bounded.ok)return json(413,{code:"REQUEST_TOO_LARGE"});
 let raw:unknown;
 try{raw=JSON.parse(bounded.rawBody);}catch{return json(400,{code:"REQUEST_JSON_INVALID"});}
 if(!raw||typeof raw!=="object"||Array.isArray(raw) ||
    Object.getPrototypeOf(raw)!==Object.prototype ||
    Reflect.ownKeys(raw).length!==1 || !Object.hasOwn(raw,"workspaceSlug") ||
    typeof (raw as Record<string,unknown>).workspaceSlug!=="string")
   return json(400,{code:"REQUEST_SCHEMA_INVALID"});
 const slug=(raw as Record<string,string>).workspaceSlug;
 if(slug.length<3||slug.length>40||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
   return json(400,{code:"REQUEST_SCHEMA_INVALID"});
 let result:AuthorizedFinanceReviewResult;
 try{result=await run(slug);}catch{return json(503,{code:"FINANCE_SNAPSHOT_UNAVAILABLE"});}
 if(!result.ok)return json(result.code==="FINANCE_OWNER_REQUIRED"?403:
    result.code==="FINANCE_INPUT_INVALID"?400:503,{code:result.code});
 return json(200,result.value);
}
