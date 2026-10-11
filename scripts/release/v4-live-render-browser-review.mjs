#!/usr/bin/env node
/**
 * V4 public Render visual-readiness proof. Credential-free, GET-only and
 * explicitly NOT authenticated staff QA. Runs on a GitHub-hosted runner.
 * The allowed Render host and expected SHA are PINNED; never follow redirects.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";

const origin = "https://servicedesk-v3-frontend-review.onrender.com";
const expectedSha = "ffd8ceb12a817ec9e3bb6713e8ef43c0f38af1d1";
const expectedRoutes = [
  ["/", "A cleaner way to run your cleaning business"],
  ["/features", "Everything a cleaning operations team needs"],
  ["/use-cases/cleaning", "Built for residential cleaning operations"],
  ["/pricing", "Service quote pricing stays transparent"],
  ["/integrations", "Connect the systems your operation already uses"],
  ["/contact", "See ServiceDesk against your real cleaning workflow"],
  ["/help", "Help for the workflows your team uses"],
  ["/privacy", "Privacy starts with workspace"],
  ["/terms", "Clear product boundaries before launch"],
  ["/tour", "See how a little clarity changes"],
  ["/auth/sign-in", "Ready for what's next"],
  ["/sandbox", "sandbox"],
];
const viewports = [320, 390, 834, 1280, 1440];
const targetHeight = (w) => w <= 390 ? 812 : 900;
const chrome = process.env.V4_REVIEW_CHROME;
const out = resolve(process.env.V4_REVIEW_OUTPUT || join(tmpdir(), "v4-render-public-review"));
const root = resolve(process.cwd());
if (!/^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin) ||
    !/^[a-f0-9]{40}$/.test(expectedSha) ||
    !chrome || !existsSync(chrome) || !statSync(chrome).isFile() ||
    out === root || out.startsWith(root + "/") || existsSync(out)) {
  throw new Error("Invalid or unsafe real-Render public review configuration.");
}
mkdirSync(out, { recursive: true, mode: 0o700 });

async function fetchPublic(path, accept="text/html") {
  const r = await fetch(origin + path, {
    method: "GET", redirect: "manual", cache: "no-store",
    headers: { Accept: accept, "Cache-Control": "no-store" },
    signal: AbortSignal.timeout(25000),
  });
  if (r.status !== 200 || (r.headers.get("content-type") || "").includes("image")) {
    throw new Error("Real-Render public route not HTTP 200: " + path + " " + r.status);
  }
  const t = await r.text();
  if (t.length < 15 || t.length > 2_500_000) throw new Error("Unexpected bounded public response: " + path);
  return t;
}
const health = JSON.parse(await fetchPublic("/health", "application/json"));
if (health?.ok !== true || health?.service !== "servicedesk" ||
    health?.sourceSha !== expectedSha || health?.sourceProvider !== "render") {
  throw new Error("Render preview is NOT the independently pinned V4 source.");
}
console.log("PASS exact deployed source SHA:", expectedSha);

for (const [path] of expectedRoutes) await fetchPublic(path);
console.log("PASS 12 credential-free public HTTP endpoints including the synthetic sandbox.");

const profile = resolve(out, "private-chrome-profile");
mkdirSync(profile, { mode: 0o700 });
let proc, ws;
let cid = 0;
const pending = new Map();
function rpc(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++cid;
    const timer = setTimeout(() => { pending.delete(id); reject(Error("CDP timeout: " + method)); }, 24000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalInPage(expression) {
  const r = await rpc("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error("Browser evaluation failed: " + (r.exceptionDetails.text || ""));
  return r.result?.value;
}
const screenshots = [],checks = [],images = [],errors = [];
try {
  proc = spawn(chrome, [
    "--headless=new", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--disable-dev-shm-usage", "--no-sandbox",
    "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=9222",
    "--user-data-dir=" + profile, "--window-size=1440,900", "about:blank",
  ], { stdio: "ignore" });
  let socketUrl;
  for (let i = 0; i < 110; i++) {
    if (proc.exitCode !== null) throw Error("Chrome process exited early");
    try {
      const r = await fetch("http://127.0.0.1:9222/json/list");
      if (r.ok) {
        socketUrl = (await r.json()).find(x => x.type === "page")?.webSocketDebuggerUrl;
        if (socketUrl) break;
      }
    } catch { /* Chrome is booting */ }
    await pause(150);
  }
  if (!socketUrl) throw Error("Chrome debugger did not open on loopback.");
  ws = new WebSocket(socketUrl);
  await new Promise((resolve,reject) => {
    const timer = setTimeout(() => reject(Error("WebSocket ready timeout")), 9000);
    ws.onopen = () => { clearTimeout(timer); resolve(); };
    ws.onerror = () => { clearTimeout(timer); reject(Error("Chrome CDP failure")); };
  });
  ws.onmessage = event => {
    const r = JSON.parse(String(event.data));
    if (r.method === "Runtime.exceptionThrown" && errors.length < 12) {
      errors.push("Runtime exception on page");
    }
    const item = pending.get(r.id); if (!item) return;
    clearTimeout(item.timer); pending.delete(r.id);
    if (r.error) item.reject(Error(r.error.message));
    else item.resolve(r.result);
  };
  await rpc("Page.enable");
  await rpc("Runtime.enable");
  await rpc("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  async function snap(route, width, type) {
    const r = await rpc("Page.captureScreenshot", {
      format: "png", fromSurface: true, captureBeyondViewport: false,
    });
    const data = Buffer.from(r.data || "", "base64");
    if (data.subarray(0,8).toString("hex") !== "89504e470d0a1a0a" ||
        data.readUInt32BE(16) !== width || data.readUInt32BE(20) !== targetHeight(width)) {
      throw Error("Chrome PNG integrity/viewport failure: " + route + " " + width);
    }
    const name = route.replace(/[^a-z0-9-]/g,"-").replace(/^-+|-+$/g,"") || "home";
    const filename = name + "-" + width + "-" + type + ".png";
    writeFileSync(join(out, filename), data, { mode: 0o600 });
    screenshots.push({ route, width, type, filename });
  }
  for (const width of viewports) {
    await rpc("Emulation.setDeviceMetricsOverride", {
      width, height: targetHeight(width), deviceScaleFactor: 1,
      mobile: width <= 390, screenWidth: width, screenHeight: targetHeight(width),
    });
    for (const [path, title] of expectedRoutes) {
      await rpc("Page.navigate", { url: origin + path });
      let state;
      for (let attempt = 0; attempt < 110; attempt++) {
        try {
          state = await evalInPage('(() => ({path:location.pathname,ready:document.readyState,heading:(document.querySelector("h1")?.textContent||"").trim().replace(/\\s+/g," "),robots:document.querySelector("meta[name=robots]")?.content||"",overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth),links:document.querySelectorAll("a[href]").length,reduced:matchMedia("(prefers-reduced-motion: reduce)").matches}))()');
          if (state?.path === path && state?.ready === "complete" && state.heading.length > 8) break;
        } catch { /* navigation replaced DOM */ }
        await pause(125);
      }
      if (state?.path !== path || !state?.heading || state.overflow > width + 2 ||
          !state.robots.toLowerCase().includes("noindex") ||
          state.links < 1 || !state.reduced) {
        throw Error("Live responsive / robots / heading failure: " + path + "@" + width + " " + JSON.stringify(state));
      }
      if (path !== "/sandbox" && !state.heading.includes(title)) {
        throw Error("Live public heading does not match V4 page: " + path + "@" + width + " title=" + state.heading);
      }
      await evalInPage("document.fonts.ready.then(() => true)");
      await pause(80);
      checks.push({ route:path,width,overflow:false,noindex:true,heading:state.heading });
      await snap(path,width,"first");
      if (width === 390 && (path === "/" || path === "/use-cases/cleaning")) {
        const result = await evalInPage('(() => { const photo=document.querySelector("[class*=heroImage],[class*=cleaningPhoto]");if(!photo)return {ok:false};const css=getComputedStyle(photo).backgroundImage;const url=css.match(/url\\(["\\\']?([^"\\\')]+)["\\\']?\\)/)?.[1];return{ok:Boolean(url),url:url||""};})()');
        if (result?.url) {
          const img = await evalInPage('(async ()=>{const x='+JSON.stringify(result.url)+';const i=new Image();i.src=x;try{await i.decode();return{ok:i.naturalWidth>200,width:i.naturalWidth};}catch{return{ok:false}}})()');
          images.push({route:path,ready:img?.ok===true,naturalWidth:img?.width||0});
        }
      }
      if (width === 390 && path === "/") {
        const q = await evalInPage('(async()=>{const b=[...document.querySelectorAll("button[aria-pressed]")].find(x=>x.textContent?.includes("Scheduling"));if(!b)return{ok:false};b.click();await new Promise(r=>setTimeout(r,220));return{ok:b.getAttribute("aria-pressed")==="true",text:document.querySelector("[aria-live=polite]")?.textContent||""}})()');
        if (!q?.ok || !q.text.includes("Capacity checks")) throw Error("Live AI preview tab is inert.");
        await snap(path,width,"ai-selected");
      }
      if (width === 390 && path === "/features") {
        const q=await evalInPage('(async()=>{const b=[...document.querySelectorAll("button[aria-pressed]")].find(x=>x.textContent?.includes("Dispatch"));if(!b)return{ok:false};b.click();await new Promise(r=>setTimeout(r,230));return{ok:b.getAttribute("aria-pressed")==="true",text:document.querySelector("[aria-live=polite]")?.textContent||""}})()');
        if(!q?.ok || !q.text.toLowerCase().includes("capacity"))throw Error("Live Features workflow tab is inert.");
        await snap(path,width,"workflow-selected");
      }
      if (width === 390 && path === "/contact") {
        const q=await evalInPage('(async()=>{const b=document.querySelector("input[type=checkbox]");if(!b)return{ok:false};b.click();await new Promise(r=>setTimeout(r,220));return{ok:b.checked,text:document.body.textContent||""}})()');
        if(!q?.ok || !q.text.includes("1 topic selected"))throw Error("Live consultation planner does not update.");
      }
      await evalInPage("window.scrollTo({top:Math.floor((document.documentElement.scrollHeight-innerHeight)/2),behavior:'instant'})");
      await pause(85);
      await snap(path,width,"middle");
    }
  }
  if (images.some(x=>x.ready===false)) {
    throw Error("Approved cleaning photographs failed to load on live Render: "+images.filter(x=>!x.ready).map(x=>x.route));
  }
  const manifest={
    status:"PUBLIC_LIVE_RENDER_BROWSER_PROVEN_NOT_AUTHENTICATED_STAFF_ACCEPTANCE",
    host:origin,sourceSha:expectedSha,routeCount:expectedRoutes.length,
    checks,screenshots,images,reducedMotion:true,
    runtimeExceptionCount:errors.length,
    capturedAt:new Date().toISOString(),
  };
  writeFileSync(join(out,"manifest.json"),JSON.stringify(manifest,null,2),{mode:0o600});
  console.log("PASS live V4 Chrome: "+screenshots.length+" screenshots / "+checks.length+
    " responsive checks / "+images.length+" remote photo checks. No tenant/provider/DB actions.");
  if (errors.length) console.log("NOTICE public runtime exception events:",errors.length);
} finally {
  ws?.close();
  proc?.kill();
  try { rmSync(profile,{recursive:true,force:true,maxRetries:9,retryDelay:150}); } catch { /* ephemeral only */ }
}
