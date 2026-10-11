#!/usr/bin/env node
/**
 * Real Chrome READ-ONLY protection check for all 13 Studio modules.
 * Runs unauthenticated with a fabricated workspace slug. Never logs
 * tenant data, performs a mutation, or attempts login.
 */
import {spawn} from "node:child_process";
import {existsSync,mkdtempSync,mkdirSync,rmSync,writeFileSync,statSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve,join} from "node:path";
import {setTimeout as sleep} from "node:timers/promises";
const origin=process.env.V4_ANON_ORIGIN || "https://servicedesk-v3-frontend-review.onrender.com";
if(!["https://servicedesk-v3-frontend-review.onrender.com","http://127.0.0.1:3000"].includes(origin))
  throw Error("ANON_STUDIO_UNAPPROVED_ORIGIN");
const chrome=process.env.V4_ANON_CHROME, outputDir=process.env.V4_ANON_OUTPUT;
if(!chrome||!existsSync(chrome)||!statSync(chrome).isFile()||!outputDir)
  throw Error("ANON_STUDIO_BROWSER_OR_OUTPUT_REQUIRED");
const output=resolve(outputDir),root=resolve(process.cwd());
if(output===root||output.startsWith(root+"/")||existsSync(output))throw Error("ANON_STUDIO_UNSAFE_OUTPUT");
mkdirSync(output,{recursive:true,mode:0o700});
const profile=mkdtempSync(join(tmpdir(),"sd-v4-anon-studio-"));
const modules=["overview","inbox","customers","requests","quotes","schedule","jobs","invoices",
  "quality","automations","reports","settings","billing"];
const widths=[320,390,834,901,1024,1280,1440];
const slug="not-your-workspace";
let child,conn;
const manifest={kind:"ANONYMOUS_STUDIO_DENIAL_BROWSER_NOT_SIGNED_IN_ACCEPTANCE",origin,widths,modules,checks:[],screenshots:[]};
async function launch(){
  child=spawn(chrome,["--headless=new","--no-first-run","--no-default-browser-check",
    "--no-sandbox","--disable-dev-shm-usage","--disable-extensions",
    "--remote-debugging-address=127.0.0.1","--remote-debugging-port=9238",
    "--user-data-dir="+profile,"--window-size=1440,900","about:blank"],{stdio:"ignore"});
  for(let i=0;i<90;i++){
    if(child.exitCode!==null)throw Error("ANON_CHROME_EXITED");
    try{let r=await fetch("http://127.0.0.1:9238/json/list");if(r.ok){
      const t=(await r.json()).find(x=>x.type==="page"&&x.webSocketDebuggerUrl);
      if(t)return t.webSocketDebuggerUrl;
    }}catch{} await sleep(170);
  }throw Error("ANON_CHROME_UNAVAILABLE");
}
async function connect(url){
  const ws=new WebSocket(url),pending=new Map();let seq=0;
  await new Promise((ok,no)=>{let timer=setTimeout(()=>no(Error("ANON_WS_TIMEOUT")),10000);
    ws.onopen=()=>{clearTimeout(timer);ok()};ws.onerror=()=>no(Error("ANON_WS_FAILURE"))});
  ws.onmessage=e=>{const p=JSON.parse(String(e.data));const v=pending.get(p.id);if(!v)return;
    pending.delete(p.id);clearTimeout(v.t);p.error?v.no(Error("CDP_ERROR")):v.ok(p.result)};
  return {send(method,params={}){return new Promise((ok,no)=>{const id=++seq;
    const t=setTimeout(()=>{pending.delete(id);no(Error("CDP_TIMEOUT_"+method))},30000);
    pending.set(id,{ok,no,t});ws.send(JSON.stringify({id,method,params}))})},close(){ws.close()}};
}
async function evalInPage(expression){
  const r=await conn.send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error("ANON_CHROME_EVALUATION");
  return r.result?.value;
}
async function stable(expected){
  for(let i=0;i<100;i++){
    try{let s=await evalInPage('({path:location.pathname,ready:document.readyState==="complete",main:!!document.querySelector("main")})');
      if(s?.ready&&s.main&&(s.path===expected||s.path.startsWith("/auth/sign-in")))return s.path;
    }catch{} await sleep(140);
  }throw Error("ANON_ROUTE_UNSTABLE");
}
async function screenshot(module,width){
  const r=await conn.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
  const png=Buffer.from(r.data||"","base64");
  if(png.subarray(0,8).toString("hex")!=="89504e470d0a1a0a"||png.readUInt32BE(16)!==width)
    throw Error("ANON_SCREENSHOT_BAD");
  const file=module+"-"+width+".png";writeFileSync(join(output,file),png,{mode:0o600});
  manifest.screenshots.push(file);
}
try {
  // Host uses only a same-origin session cookie; no account is created.
  for(const module of modules){
    const response=await fetch(origin+"/app/"+slug+"/"+module,{redirect:"manual"});
    if(response.status>=500)throw Error("ANON_STUDIO_HTTP_5XX_"+module);
  }
  // These must reject cross-origin, malformed and valid-but-unauthorized actions
  // even when no provider is configured or available.
  const endpoint=origin+"/api/internal/ai/request-brief";
  const valid={workspaceSlug:slug,requestId:"00000000-0000-4000-8000-000000000001"};
  const attempts=[
    {name:"without-origin",headers:{"content-type":"application/json"},body:JSON.stringify(valid),statuses:[403]},
    {name:"foreign-origin",headers:{"content-type":"application/json","origin":"https://example.org"},body:JSON.stringify(valid),statuses:[403]},
    {name:"invalid-schema",headers:{"content-type":"application/json","origin":origin},body:JSON.stringify({workspaceSlug:slug}),statuses:[400]},
    {name:"no-staff-session",headers:{"content-type":"application/json","origin":origin},body:JSON.stringify(valid),statuses:[401,403]},
  ];
  for(const a of attempts){
    const response=await fetch(endpoint,{method:"POST",headers:a.headers,body:a.body,redirect:"manual"});
    const decoded=await response.json().catch(()=>null);
    const code=typeof decoded?.code==="string"&&/^[A-Z_]+$/.test(decoded.code)?decoded.code:"UNKNOWN_RESPONSE";
    if(!a.statuses.includes(response.status))throw Error("ANON_AI_ENDPOINT_"+a.name+"_"+response.status+"_"+code);
    manifest.checks.push({type:"ai-denial",name:a.name,status:response.status,code});
  }
  conn=await connect(await launch());await conn.send("Page.enable");await conn.send("Runtime.enable");
  await conn.send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
  for(const width of widths){
    await conn.send("Emulation.setDeviceMetricsOverride",{width,height:width<=390?812:900,
      screenWidth:width,screenHeight:width<=390?812:900,deviceScaleFactor:1,mobile:width<=390});
    for(const module of modules){
      const path="/app/"+slug+"/"+module;
      const nav=await conn.send("Page.navigate",{url:origin+path});if(nav.errorText)throw Error("ANON_NAV_"+module);
      const location=await stable(path);
      const state=await evalInPage('(() => {const shown=e=>{if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none"};' +
        'return {path:location.pathname,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,' +
        'signin:shown(document.querySelector("a.app-auth-entry-link"))||!!document.querySelector("form[action] input[type=password]"),' +
        'signout:!!document.querySelector("form.app-signout-form"),privateAccount:!!document.querySelector("a.app-account-link"),' +
        'hasMain:!!document.querySelector("main"),errorOverlay:!!document.querySelector("nextjs-portal [data-nextjs-dialog-overlay]")};})()');
      if(state.errorOverlay||!state.hasMain||state.signout||state.privateAccount||
        (state.path===path&&!state.signin)||state.overflow>2)
        throw Error("ANON_STUDIO_DENIAL_OR_LAYOUT_"+module+"_"+width+"_"+JSON.stringify(state));
      manifest.checks.push({type:"anonymous-route",module,width,access:"denied",overflow:false});
      if(width===320||width===1440)await screenshot(module,width);
    }
  }
  writeFileSync(join(output,"manifest.json"),JSON.stringify(manifest,null,2),{mode:0o600});
  console.log("ANON_STUDIO_DENIAL_PASS: "+modules.length+" protected routes x "+widths.length+
    " widths; "+attempts.length+" AI API reject cases; "+manifest.screenshots.length+
    " fictional workspace screenshots. NOT REAL-AUTH ACCEPTANCE.");
}finally{
  conn?.close();child?.kill();
  try{rmSync(profile,{recursive:true,force:true,maxRetries:12,retryDelay:200})}catch{}
}
