#!/usr/bin/env node
/**
 * Read-only Chrome smoke against REAL review deployment. No credentials,
 * fixtures, DB writes, checkout POST, provider sends or fake success.
 * This tests guest denial/error handling, not customer/crew signed-in UAT.
 */
import { spawn } from "node:child_process";
import { existsSync, statSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const origin=process.env.V4_GUEST_EXTENDED_ORIGIN||"https://servicedesk-v3-frontend-review.onrender.com";
if(!["https://servicedesk-v3-frontend-review.onrender.com","http://127.0.0.1:3000"].includes(origin))throw Error("UNAPPROVED_GUEST_ORIGIN");
const chrome=process.env.V4_GUEST_EXTENDED_CHROME;
const output=resolve(process.env.V4_GUEST_EXTENDED_OUTPUT||join(tmpdir(),"sd-v4-ext-guest"));
if(!chrome||!existsSync(chrome)||!statSync(chrome).isFile())throw Error("GUEST_BROWSER_REQUIRED");
const root=resolve(process.cwd());
if(output===root||output.startsWith(root+"/")||existsSync(output))throw Error("UNSAFE_GUEST_OUTPUT");
const uid="00000000-0000-4000-8000-000000000001";
const fictionalSlug="nonexistent-guest-check-20261012";
const pages=[
 ["customer-portal","/portal",true],["customer-properties","/portal/properties",true],
 ["customer-preferences","/portal/preferences",true],
 ["customer-quote","/portal/quotes/"+uid,true],
 ["customer-booking","/portal/bookings/"+uid,true],
 ["customer-invoice","/portal/invoices/"+uid,true],
 ["sandbox-checkout","/portal/sandbox-checkout/"+uid,true],
 ["crew-today","/crew/today",true],["crew-job","/crew/jobs/"+uid,true],
 ["unknown-business","/b/"+fictionalSlug,false],
 ["unknown-business-book","/b/"+fictionalSlug+"/book",false],
 ["unknown-business-enquire","/b/"+fictionalSlug+"/enquire",false],
 ["create-workspace","/auth/create-workspace",true],
 ["select-workspace","/auth/select-workspace",true],
 ["reset-password","/auth/reset-password",true],
 ["invalid-invitation","/auth/invitations/invalid-review-token",true],
 ["onboarding","/onboarding",false],["onboarding-confirm","/onboarding/verified",false],
];
const widths=[320,390,834,901,1024,1280,1440];
mkdirSync(output,{recursive:true,mode:0o700});
const profile=mkdtempSync(join(tmpdir(),"sd-v4-portal-crew-"));
const report={kind:"REAL_RENDER_GUEST_EXTENDED_NO_AUTHORIZED_USER_PROOF",origin,
  paths:pages.length,widths,results:[],screenshots:[]};
let child,cdp;
async function launch(){
  child=spawn(chrome,["--headless=new","--no-first-run","--no-default-browser-check",
    "--disable-extensions","--disable-dev-shm-usage","--no-sandbox",
    "--remote-debugging-address=127.0.0.1","--remote-debugging-port=9248",
    "--user-data-dir="+profile,"--window-size=1440,900","about:blank"],{stdio:"ignore"});
  for(let i=0;i<100;i++){
    if(child.exitCode!==null)throw Error("GUEST_CHROME_EXIT");
    try{const r=await fetch("http://127.0.0.1:9248/json/list");
      if(r.ok){const tab=(await r.json()).find(x=>x.type==="page"&&x.webSocketDebuggerUrl);
        if(tab)return tab.webSocketDebuggerUrl}
    }catch{} await sleep(140);
  }
  throw Error("GUEST_CHROME_SOCKET_UNAVAILABLE");
}
async function connect(url){
  const ws=new WebSocket(url),calls=new Map();let next=0;
  await new Promise((ok,fail)=>{
    const timer=setTimeout(()=>fail(Error("CDP_OPEN_TIMEOUT")),10000);
    ws.onopen=()=>{clearTimeout(timer);ok()};
    ws.onerror=()=>{clearTimeout(timer);fail(Error("CDP_OPEN_ERROR"))};
  });
  ws.onmessage=event=>{
    const packet=JSON.parse(String(event.data)),item=calls.get(packet.id);
    if(!item)return;calls.delete(packet.id);clearTimeout(item.timer);
    if(packet.error)item.reject(Error("CDP_ERROR"));else item.resolve(packet.result);
  };
  return {send(method,params={}){
      return new Promise((resolve,reject)=>{
        const id=++next;
        const timer=setTimeout(()=>{calls.delete(id);reject(Error("CDP_TIMEOUT"))},30000);
        calls.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
      });
    },close(){ws.close()}
  };
}
async function evaluate(expression){
  const r=await cdp.send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails)throw Error("GUEST_JS_EVAL");
  return r.result?.value;
}
async function ready(expected){
  for(let i=0;i<110;i++){
    try{
      const state=await evaluate('({path:location.pathname,ready:document.readyState==="complete",body:!!document.body})');
      if(state?.ready&&state.body&&(state.path===expected||state.path.startsWith("/auth/")))return state.path;
    }catch{} await sleep(125);
  }
  throw Error("GUEST_NAVIGATION_TIMEOUT");
}
try{
  for(const [name,path] of pages){
    const response=await fetch(origin+path,{redirect:"manual",signal:AbortSignal.timeout(15000)});
    if(response.status>=500 || response.status===0)throw Error("GUEST_HTTP_5XX_"+name+"_"+response.status);
    report.results.push({name,httpStatus:response.status});
  }
  cdp=await connect(await launch());
  await cdp.send("Page.enable");await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
  for(const width of widths){
    await cdp.send("Emulation.setDeviceMetricsOverride",{width,height:width<=390?812:900,
      screenWidth:width,screenHeight:width<=390?812:900,deviceScaleFactor:1,mobile:width<=390});
    for(const [name,path,privateSurface] of pages){
      const nav=await cdp.send("Page.navigate",{url:origin+path});
      if(nav.errorText)throw Error("GUEST_NAV_ERROR_"+name);
      const landed=await ready(path);
      const state=await evaluate('(() => ({path:location.pathname,rootWidth:document.documentElement.scrollWidth,'+
        'bodyWidth:document.body.scrollWidth,width:innerWidth,'+
        'account:!!document.querySelector("a.app-account-link"),'+
        'signout:!!document.querySelector("form.app-signout-form"),'+
        'errOverlay:!!document.querySelector("nextjs-portal [data-nextjs-dialog-overlay]"),'+
        'main:!!document.querySelector("main"),'+
        'textLength:(document.querySelector("main")?.textContent||document.body.textContent||"").trim().length,'+
        'privateControls:document.querySelectorAll("form[data-operational-action],button[data-billing-payment]").length,'+
        'h1:document.querySelector("h1")?.textContent?.trim()?.length||0}))()');
      if(state.width!==width || state.errOverlay || state.account || state.signout ||
          state.privateControls>0 || !state.textLength ||
          Math.max(state.rootWidth,state.bodyWidth)>width+2)
        throw Error("GUEST_EXTENDED_LAYOUT_OR_AUTH_"+name+"_"+width+JSON.stringify({
          route:state.path,overflow:Math.max(state.rootWidth,state.bodyWidth)-width,
          account:state.account,signout:state.signout,controls:state.privateControls,overlay:state.errOverlay
        }));
      if(privateSurface && landed!==path && !landed.startsWith("/auth/"))
        throw Error("GUEST_PROTECTED_UNEXPECTED_REDIRECT_"+name);
      report.results.push({name,width,privateSurface,guest:true,horizontalOverflow:false,
        routeMatch:landed===path});
      if(width===320||width===1440){
        const response=await cdp.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
        const image=Buffer.from(response.data||"","base64");
        if(image.subarray(0,8).toString("hex")!=="89504e470d0a1a0a"||image.readUInt32BE(16)!==width)
          throw Error("GUEST_EXTENDED_SCREENSHOT_INVALID");
        const file=name+"-"+width+".png";
        writeFileSync(join(output,file),image,{mode:0o600});
        report.screenshots.push(file);
      }
    }
  }
  writeFileSync(join(output,"manifest.json"),JSON.stringify(report,null,2),{mode:0o600});
  console.log("REAL_RENDER_EXTENDED_GUEST_PASS: "+pages.length+" routes x "+widths.length+
    " widths, read-only Chrome; no authenticated customer, crew or provider proof");
}finally{
  cdp?.close();child?.kill();
  try{rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200})}catch{}
}
