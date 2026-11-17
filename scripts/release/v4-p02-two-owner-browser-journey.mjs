#!/usr/bin/env node
/**
 * Manual, exact-SHA-approved P02 Chrome UAT: two fresh browser profiles.
 * Uses the real Next sign-in form and read-only /onboarding/verified page.
 * Does NOT create accounts, seed fixtures, run SQL, contact providers or deploy.
 * Requires the independently approved real JWT/RLS job in the same workflow.
 * Only sanitized PASS/FAIL labels and pseudonymous A/B receipts are emitted.
 */
import {spawn} from "node:child_process";
import {existsSync, mkdtempSync, mkdirSync, rmSync, statSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {setTimeout as sleep} from "node:timers/promises";
import {
  LOCAL_ORIGIN, assertBrowserReadback, hasForeignReadyDisclosure,
  validateTwoOwnerBrowserConfig
} from "./v4-p02-two-owner-browser-contract.mjs";

const owners = validateTwoOwnerBrowserConfig(process.env);
const chrome = process.env.V4_P02_BROWSER_CHROME;
const output = resolve(process.env.V4_P02_BROWSER_OUTPUT);
const root = resolve(process.cwd());
if (!existsSync(chrome) || !statSync(chrome).isFile() ||
    existsSync(output) || output === root ||
    output.startsWith(root + "/"))
  throw Error("P02_BROWSER_BLOCKED_PRIVATE_RUNTIME");
mkdirSync(output, {recursive:true, mode:0o700});

function browserSnapshotExpression() {
  return '(() => {' +
    'const heading=document.querySelector("h1")?.textContent?.trim()||"";' +
    'const ready=[...document.querySelectorAll("[role=status]")].map(x=>x.textContent?.trim()).find(x=>x?.startsWith("Email confirmed."))||"";' +
    'const denial=[...document.querySelectorAll("[role=alert]")].map(x=>x.textContent?.trim()).find(x=>x?.startsWith("Workspace verification could not be completed."))||"";' +
    'const details=document.querySelector("[aria-label=\\"Verified workspace details\\"]");' +
    'const address=[...(details?.querySelectorAll("dt")||[])].find(x=>x.textContent?.trim()==="Workspace address");' +
    'const slug=address?.nextElementSibling?.textContent?.trim()||"";' +
    'return {path:location.pathname,queryWorkspace:new URL(location.href).searchParams.get("workspace"),' +
    'heading,readyStatus:ready,denialAlert:denial,savedWorkspaceSlug:slug,' +
    'verifiedDetails:!!details,signInEntry:!!document.querySelector("#sign-in-email"),' +
    'qaMutationControl:[...document.querySelectorAll("button")].some(x=>x.textContent?.includes("Add fictional QA records")),' +
    'nextErrorOverlay:!!document.querySelector("nextjs-portal [data-nextjs-dialog-overlay]")};})()';
}

async function runOwner(owner, foreignSlug, index) {
  // One Chrome process and unique ephemeral profile per real owner. Never
  // transfer cookies, storage, tokens, CDP state or browser history between A/B.
  const profile = mkdtempSync(join(tmpdir(),"sonic-p02-owner-" + owner.tag + "-"));
  const port = 9390 + index;
  const child = spawn(chrome, [
    "--headless=new","--no-first-run","--disable-extensions",
    "--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=" + port,
    "--user-data-dir=" + profile,"about:blank"
  ],{stdio:"ignore"});
  let socket;
  const pending = new Map();
  let sequence=0;
  async function discover() {
    for(let i=0;i<100;i++){
      if(child.exitCode!==null) throw Error("P02_BROWSER_CHROME_EXITED");
      try {
        const res=await fetch("http://127.0.0.1:"+port+"/json/list",
          {signal:AbortSignal.timeout(1200)});
        if(res.ok) {
          const tabs=await res.json();
          const tab=tabs.find(x=>x.type==="page" && x.webSocketDebuggerUrl);
          if(tab) return tab.webSocketDebuggerUrl;
        }
      } catch { /* Chrome startup is bounded */ }
      await sleep(150);
    }
    throw Error("P02_BROWSER_CDP_UNAVAILABLE");
  }
  async function connect(url){
    socket=new WebSocket(url);
    await new Promise((ok,fail)=>{
      const timeout=setTimeout(()=>fail(Error("P02_BROWSER_CDP_TIMEOUT")),10000);
      socket.onopen=()=>{clearTimeout(timeout);ok();};
      socket.onerror=()=>{clearTimeout(timeout);fail(Error("P02_BROWSER_CDP_FAILED"));};
    });
    socket.onmessage=event=>{
      let packet;
      try {packet=JSON.parse(String(event.data));} catch {return;}
      const waiter=pending.get(packet.id);
      if(!waiter)return;
      pending.delete(packet.id);
      clearTimeout(waiter.timeout);
      packet.error?waiter.reject(Error("P02_BROWSER_CDP_COMMAND_FAILED")):waiter.resolve(packet.result);
    };
  }
  function send(method,params={}){
    return new Promise((ok,fail)=>{
      const id=++sequence;
      const timeout=setTimeout(()=>{
        pending.delete(id); fail(Error("P02_BROWSER_CDP_COMMAND_TIMEOUT"));
      },30000);
      pending.set(id,{resolve:ok,reject:fail,timeout});
      socket.send(JSON.stringify({id,method,params}));
    });
  }
  async function evaluate(expression){
    const result=await send("Runtime.evaluate",
      {expression,awaitPromise:true,returnByValue:true});
    if(result.exceptionDetails) throw Error("P02_BROWSER_EVALUATION_FAILED");
    return result.result?.value;
  }
  async function visit(path){
    await send("Page.navigate",{url:LOCAL_ORIGIN+path});
  }
  async function read(){return evaluate(browserSnapshotExpression());}
  async function verify(ownSlug,requested,phase){
    for(let n=0;n<160;n++){
      let snapshot;
      try {snapshot=await read();}catch{await sleep(250);continue;}
      // A confirmed foreign saved-workspace readiness disclosure is a hard
      // privacy breach. Do not wait out the normal loading/retry budget.
      // Only the exact foreign slug is terminal; stale own DOM is not.
      if(phase==="FOREIGN_DENIED" &&
          hasForeignReadyDisclosure(snapshot,ownSlug,requested))
        throw Error("P02_BROWSER_FOREIGN_READINESS_EXPOSED");
      try{assertBrowserReadback(snapshot,ownSlug,requested,phase);return;}
      catch{await sleep(250);}
    }
    throw Error("P02_BROWSER_" + phase + "_NOT_VERIFIED");
  }
  try {
    await connect(await discover());
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setEmulatedMedia",{
      features:[{name:"prefers-reduced-motion",value:"reduce"}]});
    const ownPath="/onboarding/verified?workspace="+encodeURIComponent(owner.slug);
    await visit(ownPath);
    // A fresh unauthenticated profile may not see owner readiness.
    let guestDenied=false;
    for(let n=0;n<120;n++){
      const state=await evaluate('({path:location.pathname,ready:!!document.querySelector("[aria-label=\\"Verified workspace details\\"]")})');
      if(state?.path==="/auth/sign-in" && !state.ready){guestDenied=true;break;}
      await sleep(250);
    }
    if(!guestDenied) throw Error("P02_BROWSER_ANONYMOUS_ROUTE_NOT_DENIED");
    await visit("/auth/sign-in?next="+encodeURIComponent(ownPath));
    let submitted=false;
    for(let n=0;n<100;n++){
      const prepared=await evaluate('(() => {const e=document.querySelector("#sign-in-email"),p=document.querySelector("#sign-in-password");return !!(e&&p&&e.closest("form")?.querySelector("input[name=next]"));})()');
      if(prepared){
        const payload=JSON.stringify({email:owner.email,password:owner.password,next:ownPath});
        submitted=await evaluate('(() => {const d='+payload+';const e=document.querySelector("#sign-in-email"),p=document.querySelector("#sign-in-password"),f=e?.closest("form"),next=f?.querySelector("input[name=next]");if(!e||!p||!f||!next||next.value!==d.next)return false;const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;for(const [field,value] of [[e,d.email],[p,d.password]]){set.call(field,value);field.dispatchEvent(new Event("input",{bubbles:true}));field.dispatchEvent(new Event("change",{bubbles:true}));}f.requestSubmit();return true;})()');
        break;
      }
      await sleep(200);
    }
    if(!submitted) throw Error("P02_BROWSER_SIGNIN_FORM_UNAVAILABLE");
    await verify(owner.slug,owner.slug,"OWN");
    await visit("/onboarding/verified?workspace="+encodeURIComponent(foreignSlug));
    await verify(owner.slug,foreignSlug,"FOREIGN_DENIED");
    await visit(ownPath);
    await verify(owner.slug,owner.slug,"OWN");
    return {owner:owner.tag,anonymousDenied:true,savedOwnerAndBranch:true,
      foreignAppRouteDenied:true,ownSessionRecovered:true,isolatedProfile:true};
  } finally {
    try { socket?.close(); } catch {}
    child.kill();
    try { rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200}); }
    catch { /* local temporary QA profile; never touch owner device */ }
  }
}

try {
  const receipts=[];
  for(let i=0;i<owners.length;i++)
    receipts.push(await runOwner(owners[i],owners[1-i].slug,i));
  const result={status:"REAL_TWO_OWNER_BROWSER_ONBOARDING_READBACK_ONLY",
    sha:process.env.GITHUB_SHA,readOnly:true,providerVerified:false,
    productionReady:false,requiresPairedRealRlsReceipt:true,
    receipts};
  writeFileSync(join(output,"p02-two-owner-browser-manifest.json"),
    JSON.stringify(result,null,2)+"\n",{mode:0o600,flag:"wx"});
  console.log("REAL_TWO_OWNER_BROWSER_ONBOARDING_READBACK_PASS: A/B own saved branch, foreign denial, session recovery; paired JWT/RLS required");
} catch(error) {
  // Never print provider responses, usernames, passwords, page HTML or cookies.
  const code=String(error?.message||"");
  console.error(/^[A-Z0-9_]+$/.test(code)?code:"P02_BROWSER_ACCEPTANCE_FAILED");
  process.exitCode=1;
}
