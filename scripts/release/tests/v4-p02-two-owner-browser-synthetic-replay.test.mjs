import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { once } from "node:events";

/**
 * Test the REAL Chrome runner against a fake loopback-only HTTP fixture.
 * Auth credentials, data, routes and cookies here are entirely synthetic.
 * No Supabase, SQL, provider, paid API, customer, or production environment.
 * This test never counts as genuine two-owner Auth/RLS/browser acceptance.
 */
const LOCAL = "http://127.0.0.1:3000";
const owners = [
  { tag:"A", email:"fictional-a@example.invalid", password:"synthetic-a-password", slug:"fictional-a" },
  { tag:"B", email:"fictional-b@example.invalid", password:"synthetic-b-password", slug:"fictional-b" },
];
const ready = "Email confirmed. Owner, workspace and active default branch verified against the database.";
const denied = "Workspace verification could not be completed. Your account has not been changed.";
const runner = resolve("scripts/release/v4-p02-two-owner-browser-journey.mjs");
function html(body) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><main>' +
    body + "</main></body></html>";
}
function signin(next) {
  if (!owners.some(x=>next==="/onboarding/verified?workspace="+x.slug)) next="/auth/continue";
  return html('<h1>Sign in</h1><form action="/auth/sign-in" method="post">' +
    '<input type="email" id="sign-in-email" name="email">' +
    '<input type="password" id="sign-in-password" name="password">' +
    '<input type="hidden" name="next" value="'+next+'">' +
    '<button type="submit">Sign in</button></form>');
}
function success(slug) {
  return html("<h1>Your business workspace is ready.</h1><p role=\"status\">"+ready+
    '</p><div aria-label="Verified workspace details"><dl><div>'+
    "<dt>Workspace address</dt><dd>"+slug+"</dd></div></dl></div>");
}
function denial() {
  return html("<h1>We could not verify this workspace</h1><p role=\"alert\">"+
    denied+"</p>");
}
function serverFixture(leak) {
  const events=[];
  function send(res,status,body,extra={}) {
    res.writeHead(status,{"Content-Type":"text/html; charset=utf-8",
      "Cache-Control":"private, no-store",...extra});
    res.end(body);
  }
  const server=createServer(async(req,res)=>{
    try {
      const url=new URL(req.url||"/",LOCAL);
      const tag=/(?:^|;\s*)sd_mock_owner=(A|B)(?:;|$)/.exec(req.headers.cookie||"")?.[1];
      const owner=owners.find(x=>x.tag===tag);
      if(req.method==="GET" && url.pathname==="/") {
        send(res,200,html("<h1>Fictional QA fixture</h1>"));return;
      }
      if(req.method==="GET" && url.pathname==="/auth/sign-in") {
        send(res,200,signin(url.searchParams.get("next")));return;
      }
      if(req.method==="POST" && url.pathname==="/auth/sign-in") {
        let body="";
        for await(const chunk of req) {
          body+=String(chunk);
          if(body.length>16384) throw Error("POST_LIMIT");
        }
        const form=new URLSearchParams(body);
        const identity=owners.find(x=>x.email===form.get("email") &&
          x.password===form.get("password") &&
          form.get("next")==="/onboarding/verified?workspace="+x.slug);
        if(!identity) {events.push({kind:"rejected-login"});send(res,403,denial());return;}
        events.push({kind:"login",tag:identity.tag});
        send(res,303,"",{Location:form.get("next"),
          "Set-Cookie":"sd_mock_owner="+identity.tag+"; HttpOnly; SameSite=Lax; Path=/"});
        return;
      }
      if(req.method==="GET" && url.pathname==="/onboarding/verified") {
        const requested=url.searchParams.get("workspace");
        if(!owner) {
          events.push({kind:"guest-denied"});
          send(res,303,"",{Location:"/auth/sign-in?next=%2Fauth%2Fcontinue"});return;
        }
        if(requested===owner.slug) {
          events.push({kind:"own",tag:owner.tag});
          send(res,200,success(owner.slug));return;
        }
        if(leak && owner.tag==="A") {
          events.push({kind:"foreign-leak-injected",tag:owner.tag});
          send(res,200,success(requested));return;
        }
        events.push({kind:"foreign-denied",tag:owner.tag});
        send(res,200,denial());return;
      }
      send(res,404,html("<h1>Not in mock fixture</h1>"));
    } catch {
      send(res,500,html("<h1>Mock fixture failure</h1>"));
    }
  });
  return {server,events};
}

async function replay({leak=false}={}) {
  const chrome=process.env.V4_P02_BROWSER_CHROME;
  assert.ok(chrome && existsSync(chrome),"A real installed Chrome binary is required");
  assert.ok(existsSync(runner),"The test must execute the real production browser runner");
  const {server,events}=serverFixture(leak);
  const root=mkdtempSync(join(tmpdir(),"sonic-p02-browser-mock-"));
  const output=join(root,"private-evidence");
  let child;
  try {
    server.listen(3000,"127.0.0.1");
    await once(server,"listening");
    const sha="a".repeat(40);
    const env={...process.env,
      SUPABASE_SERVICE_ROLE_KEY:"",SUPABASE_SECRET_KEY:"",
      SD_P02_BROWSER_APPROVAL:"TWO_OWNER_READ_ONLY",
      SD_P02_BROWSER_APPROVED_SHA:sha,GITHUB_SHA:sha,
      V4_AUTH_TEST_ORIGIN:LOCAL,
      NEXT_PUBLIC_SUPABASE_URL:"https://cpmmgivhlkfbiwzhlcey.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_synthetic_offline_fixture",
      V4_P02_BROWSER_CHROME:chrome,V4_P02_BROWSER_OUTPUT:output,
      V4_P02_OWNER_A_EMAIL:owners[0].email,
      V4_P02_OWNER_A_PASSWORD:owners[0].password,
      V4_P02_OWNER_A_WORKSPACE:owners[0].slug,
      V4_P02_OWNER_B_EMAIL:owners[1].email,
      V4_P02_OWNER_B_PASSWORD:owners[1].password,
      V4_P02_OWNER_B_WORKSPACE:owners[1].slug
    };
    child=spawn(process.execPath,[runner],{cwd:process.cwd(),env,
      stdio:["ignore","pipe","pipe"]});
    let stdout="",stderr="";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data",x=>{stdout=(stdout+x).slice(-4096);});
    child.stderr.on("data",x=>{stderr=(stderr+x).slice(-4096);});
    const [code,signal]=await once(child,"exit");
    const manifestPath=join(output,"p02-two-owner-browser-manifest.json");
    const manifest=existsSync(manifestPath)
      ? JSON.parse(readFileSync(manifestPath,"utf8")) : null;
    return {code,signal,manifest,events,stdout,stderr};
  } finally {
    if(child && child.exitCode===null) child.kill("SIGKILL");
    server.closeAllConnections();
    await new Promise(resolveDone=>server.close(resolveDone));
    rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:150});
  }
}

test("actual Chrome runner: two fictional cookie-isolated owner sign-ins, own branch and foreign denials",
  {timeout:150000},async()=>{
    const result=await replay();
    assert.equal(result.code,0,"Real runner did not complete the fake local DOM journey");
    assert.equal(result.signal,null);
    assert.equal(result.manifest?.status,"REAL_TWO_OWNER_BROWSER_ONBOARDING_READBACK_ONLY");
    assert.equal(result.manifest?.productionReady,false);
    assert.equal(result.manifest?.requiresPairedRealRlsReceipt,true);
    assert.deepEqual(result.manifest?.receipts.map(x=>x.owner),["A","B"]);
    assert.ok(result.manifest.receipts.every(x=>x.anonymousDenied &&
      x.savedOwnerAndBranch && x.foreignAppRouteDenied &&
      x.ownSessionRecovered && x.isolatedProfile));
    for(const tag of ["A","B"]) {
      assert.ok(result.events.some(x=>x.kind==="login" && x.tag===tag));
      assert.ok(result.events.some(x=>x.kind==="foreign-denied" && x.tag===tag));
      assert.ok(result.events.filter(x=>x.kind==="own" && x.tag===tag).length>=2);
    }
    assert.equal(result.events.filter(x=>x.kind==="guest-denied").length,2);
    assert.ok(!result.stdout.includes(owners[0].email));
    assert.ok(!result.stdout.includes(owners[0].password));
});
test("actual Chrome runner: injected foreign browser leak never creates a passing manifest",
  {timeout:150000},async()=>{
    const result=await replay({leak:true});
    assert.notEqual(result.code,0);
    assert.equal(result.manifest,null);
    assert.ok(result.events.some(x=>x.kind==="foreign-leak-injected"));
    assert.ok(!result.stderr.includes(owners[0].email));
    assert.ok(!result.stderr.includes(owners[0].password));
});
