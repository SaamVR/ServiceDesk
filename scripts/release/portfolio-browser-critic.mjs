/**
 * Native Chrome/DevTools isolated portfolio acceptance.
 * Captures screenshots and tests synthetic interactions without new JS packages.
 */
import {spawn} from "node:child_process";
import {mkdtempSync,mkdirSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const url="http://127.0.0.1:3000";
const out=process.env.PORTFOLIO_QA_OUTPUT||join(tmpdir(),"servicedesk-portfolio-qa");
const chromeBin=process.env.CHROME_BIN;
if(!chromeBin)throw Error("CHROME_BIN must point to a locally installed Chrome executable");
mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[];
const chrome=spawn(chromeBin,[
 "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
 "--disable-background-networking","--no-first-run",
 "--remote-debugging-port=9333",
 "--user-data-dir="+mkdtempSync(join(tmpdir(),"sd-qa-")),
 "about:blank"
],{stdio:"ignore"});
chrome.on("error",error=>console.error("Chrome launch error",error));
process.on("exit",()=>chrome.kill("SIGTERM"));
async function waitFor(test,ms=20000){
 let last;const begin=Date.now();
 while(Date.now()-begin<ms){
  try{if(await test())return;}catch(error){last=error}
  await sleep(200);
 }
 throw Error("Wait failed after "+ms+" ms"+(last?": "+String(last):""));
}
let tab;
await waitFor(async()=>{
 const response=await fetch("http://127.0.0.1:9333/json/list",{signal:AbortSignal.timeout(1500)});
 if(!response.ok)return false;
 const list=await response.json();
 tab=list.find(item=>item.type==="page"&&item.webSocketDebuggerUrl);
 return !!tab;
},25000);
const socket=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{
 socket.addEventListener("open",resolve,{once:true});
 socket.addEventListener("error",reject,{once:true});
});
const pending=new Map();let sequence=0;
socket.addEventListener("message",event=>{
 const message=JSON.parse(event.data);
 if(message.id&&pending.has(message.id)){
  const pair=pending.get(message.id);pending.delete(message.id);
  if(message.error)pair.reject(Error(message.error.message));
  else pair.resolve(message.result);
 }
});
function send(method,params={}){
 return new Promise((resolve,reject)=>{
  const id=++sequence;pending.set(id,{resolve,reject});
  socket.send(JSON.stringify({id,method,params}));
 });
}
await send("Page.enable");await send("Runtime.enable");
async function js(expression){
 const r=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
 if(r.exceptionDetails)throw Error("Browser evaluation exception: "+(r.exceptionDetails.text||"unknown"));
 return r.result?.value;
}
async function setViewport(width,height=900,mobile=false){
 await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile});
}
async function navigate(path){
 await send("Page.navigate",{url:url+path});
 await waitFor(()=>js("document.readyState==='complete'&&!!document.querySelector('h1')"),25000);
 await sleep(650);
}
function assert(test,description){
 results.push({description,pass:!!test});
 console.log((test?"PASS ":"FAIL ")+description);
 if(!test)throw Error("Creative/interaction critic veto: "+description);
}
async function click(selector,label){
 const expression="(()=>{const nodes=[...document.querySelectorAll("+JSON.stringify(selector)+")];const target=nodes.find(node=>node.textContent?.includes("+JSON.stringify(label)+"));if(!target||target.disabled)return false;target.click();return true})()";
 return js(expression);
}
async function shot(name){
 const result=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false,fromSurface:true});
 writeFileSync(join(out,name),Buffer.from(result.data,"base64"));
}
async function size(){return js("({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})")}
function contrastRatio(fg,bg){
 const channels=String(fg).match(/[0-9]+(?:\.[0-9]+)?/g)?.slice(0,3).map(Number);
 if(!channels||channels.length!==3)throw Error("Cannot parse CSS color "+fg);
 const background=[1,3,5].map(i=>parseInt(bg.slice(i,i+2),16));
 const l=x=>{const n=x/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4};
 const lum=rgb=>.2126*l(rgb[0])+.7152*l(rgb[1])+.0722*l(rgb[2]);
 const a=lum(channels),b=lum(background);
 return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
async function checkContrast(selector,bg,label){
 const fg=await js("getComputedStyle(document.querySelector("+JSON.stringify(selector)+")).color");
 const ratio=contrastRatio(fg,bg);
 assert(ratio>=4.5,label+" ("+ratio.toFixed(2)+":1)");
}

async function noOverrun(title){
 const v=await size();assert(v.scrollWidth<=v.width+4,title+": horizontal overrun "+(v.scrollWidth-v.width)+"px");
}

try{
 await setViewport(1440,900);await navigate("/");
 assert((await js("document.querySelector('h1')?.textContent||''")).includes("Your business"),"Home hero renders");
 assert(await js("!!document.querySelector('a[href=\"/demo\"]')"),"Guided dashboard CTA exists");
 await checkContrast('[class*="hubCard"] [class*="stageLabel"]',"#f9fffa","Cinematic microcopy contrast >=4.5");
 await checkContrast('[class*="heroBoundary"]',"#fafdfb","Hero disclosure contrast >=4.5");

 assert(await click("button","Replay"),"Cinematic replay button responds");
 await shot("home-1440.png");await noOverrun("Home 1440");
 assert(await click("button","Explore all 8 stages"),"Detailed lifecycle expands");
 assert(await js("document.querySelector('[aria-controls=\"detailed-workflow-board\"]')?.getAttribute('aria-expanded')==='true'"),"Lifecycle has accurate ARIA state");
 assert(await click("button","Hide detailed workflow"),"Detailed lifecycle collapses");
 await setViewport(375,812,true);await navigate("/");
 await shot("home-375.png");await noOverrun("Home 375");
 await setViewport(320,740,true);await navigate("/");
 await shot("home-320.png");await noOverrun("Home 320");

 await setViewport(1440,900);await navigate("/demo");
 assert((await js("document.querySelector('h1')?.textContent||''")).includes("Overview"),"Dashboard overview renders");
 await checkContrast('[class*="metrics"] article small',"#ffffff","Dashboard metric caption contrast >=4.5");

 assert((await js("document.body.textContent||''")).includes("Welcome to the operations desk"),"First-run guide appears");
 await shot("dashboard-1440.png");
 assert(await click("button","Next guide step"),"Guided tour advances to inbox");
 assert((await js("document.body.textContent||''")).includes("Start with the customer conversation"),"Guide changes contextual instruction");
 assert(await click("button","Simulate Quote prepared"),"Real sandbox quote progression is actionable");
 await sleep(180);
 assert((await js("document.body.textContent||''")).includes("Quote prepared"),"Quote stage visible after action");
 assert(await click('nav[aria-label="Dashboard modules"] button',"AI co-pilot"),"AI tab selectable");
 assert(await click("button","Approve draft"),"Example AI draft review is interactive");
 assert((await js("document.body.textContent||''")).includes("Approved for this local preview only"),"AI approval does not claim delivery");
 assert(await click('nav[aria-label="Dashboard modules"] button',"Automation rules"),"Automation catalogue accessible");
 assert((await js("document.body.textContent||''")).includes("27 review-only workflow starters"),"Actual 27-rule catalogue visible");
 assert(await click('nav[aria-label="Dashboard modules"] button',"Audit activity"),"Audit activity selectable");
 await shot("dashboard-activity-1440.png");
 await setViewport(768,900);await navigate("/demo");await shot("dashboard-768.png");await noOverrun("Dashboard 768");
 await setViewport(375,812,true);await navigate("/demo");await shot("dashboard-375.png");await noOverrun("Dashboard 375");
 await setViewport(320,740,true);await navigate("/demo");await shot("dashboard-320.png");await noOverrun("Dashboard 320");
 await send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
 await navigate("/");await sleep(200);
 assert(await js("document.body.textContent?.includes('Motion off')"),"Reduced-motion disables cinematic autoplay");
 await shot("home-reduced-motion-320.png");
 const blocked=await fetch(url+"/auth/sign-in",{redirect:"manual"});
 assert(blocked.status===404||blocked.status===403,"Portfolio blocks sign-in HTTP route (HTTP "+blocked.status+")");
 writeFileSync(join(out,"receipt.json"),JSON.stringify({passed:true,commit:process.env.GITHUB_SHA,results,widths:[320,375,768,1440]},null,2));
}catch(error){
 writeFileSync(join(out,"receipt.json"),JSON.stringify({passed:false,error:String(error),commit:process.env.GITHUB_SHA,results},null,2));
 throw error;
}finally{
 socket.close();chrome.kill("SIGTERM");
}
