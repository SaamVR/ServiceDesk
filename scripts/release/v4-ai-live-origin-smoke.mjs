#!/usr/bin/env node
/** Public unauthenticated CSRF smoke; no provider invocation and no credentials. */
const origin="https://servicedesk-v3-frontend-review.onrender.com";
const endpoint=origin+"/api/internal/ai/request-brief";
const input=JSON.stringify({
  workspaceSlug:"nonexistent-fake-tenant",
  requestId:"00000000-0000-4000-8000-000000000001",
});
const attempts=[
 {name:"missing-origin",headers:{"content-type":"application/json"},body:input,status:403,code:"SAME_ORIGIN_REQUIRED"},
 {name:"foreign-origin",headers:{"content-type":"application/json",origin:"https://evil.example","sec-fetch-site":"cross-site"},body:input,status:403,code:"SAME_ORIGIN_REQUIRED"},
 {name:"real-origin-invalid-schema",headers:{"content-type":"application/json",origin},body:"{}",status:400,code:"REQUEST_SCHEMA_INVALID"},
 {name:"real-origin-no-owner-session",headers:{"content-type":"application/json",origin,"sec-fetch-site":"same-origin"},body:input,status:401,code:"AI_BRIEF_AUTH_REQUIRED"},
];
for(const item of attempts){
  const response=await fetch(endpoint,{method:"POST",headers:item.headers,body:item.body,redirect:"manual",signal:AbortSignal.timeout(20000)});
  const body=await response.json().catch(()=>null);
  if(response.status!==item.status||body?.code!==item.code)
    throw Error("REAL_RENDER_AI_CSRF_GATE_FAILED:"+item.name+
      ":status_"+response.status+":code_"+(typeof body?.code==="string"&&/^[A-Z_]+$/.test(body.code)?body.code:"UNEXPECTED"));
  if(!response.headers.get("cache-control")?.includes("no-store"))throw Error("REAL_RENDER_AI_CACHE_POLICY_FAILED:"+item.name);
}
console.log("REAL_RENDER_AI_CSRF_PASS: true-origin schema validation and session-denial, cross-origin and empty-Origin blocked; NO MODEL CALL, NO CUSTOMER CHANGES");
