#!/usr/bin/env node
/**
 * Private REAL-AUTH staging browser gate; never use against customer/production.
 *
 * Requires a pre-existing authorized fictional QA owner with confirmed email.
 * No user creation, payment, email sends, provider calls or service-role keys.
 * Logs only a constant gate label; no credentials, cookies or tenant records.
 * Screenshots may display fictional tenant details; retain privately for <=1d.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const origin = process.env.V4_AUTH_TEST_ORIGIN || "https://servicedesk-v3-frontend-review.onrender.com";
if (!["https://servicedesk-v3-frontend-review.onrender.com", "http://127.0.0.1:3000"].includes(origin)) {
  throw new Error("AUTHENTICATED_STUDIO_UAT_BLOCKED: unapproved origin");
}
if (origin === "http://127.0.0.1:3000") {
  let qaProject;
  try { qaProject = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL); }
  catch { throw new Error("AUTHENTICATED_STUDIO_UAT_BLOCKED: QA Supabase URL is missing"); }
  if (qaProject.protocol !== "https:" || qaProject.hostname !== "cpmmgivhlkfbiwzhlcey.supabase.co" ||
      qaProject.pathname !== "/" || qaProject.search || qaProject.hash) {
    throw new Error("AUTHENTICATED_STUDIO_UAT_BLOCKED: refusing non-staging database");
  }
}
const { V4_AUTH_QA_EMAIL: email, V4_AUTH_QA_PASSWORD: password,
  V4_AUTH_QA_WORKSPACE: slug, V4_AUTH_CHROME: chrome, V4_AUTH_OUTPUT: outputDir } = process.env;
if (!email || !password || !slug || !chrome || !outputDir ||
  !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
  slug.length > 40 || !existsSync(chrome) || !statSync(chrome).isFile()) {
  throw new Error("AUTHENTICATED_STUDIO_UAT_BLOCKED: existing allowlisted QA credentials/workspace/Chrome/output required");
}
const output = resolve(outputDir);
const cwd = resolve(process.cwd());
if (output === cwd || output.startsWith(cwd + "/") || existsSync(output)) {
  throw new Error("AUTHENTICATED_STUDIO_UAT_BLOCKED: private output must be new and outside the checkout");
}
mkdirSync(output, { recursive: true, mode: 0o700 });
const profile = mkdtempSync(join(tmpdir(), "sd-v4-auth-profile-"));
const widths = [320, 390, 834, 901, 1024, 1280, 1440];
const staffModules = [
  "overview", "inbox", "customers", "requests", "quotes", "schedule",
  "jobs", "invoices", "quality", "automations", "reports", "settings", "billing",
];
let child, channel;
const report = [];

async function launch() {
  child = spawn(chrome, [
    "--headless=new", "--no-first-run", "--disable-extensions",
    "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
    "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=9228",
    "--user-data-dir=" + profile, "--window-size=1440,900", "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error("Chrome exited");
    try {
      const response = await fetch("http://127.0.0.1:9228/json/list", { signal: AbortSignal.timeout(1200) });
      if (response.ok) {
        const list = await response.json();
        const tab = list.find(x => x.type === "page" && x.webSocketDebuggerUrl);
        if (tab) return tab.webSocketDebuggerUrl;
      }
    } catch { /* browser warming */ }
    await sleep(150);
  }
  throw new Error("Chrome debug socket unavailable");
}
async function connect(url) {
  const ws = new WebSocket(url);
  const waiting = new Map();
  let index = 0;
  await new Promise((accept, reject) => {
    const timeout = setTimeout(() => reject(new Error("Private Chrome socket timeout")), 10000);
    ws.onopen = () => { clearTimeout(timeout); accept(); };
    ws.onerror = () => { clearTimeout(timeout); reject(new Error("Private Chrome socket failure")); };
  });
  ws.onmessage = event => {
    const packet = JSON.parse(String(event.data));
    const waiter = waiting.get(packet.id);
    if (!waiter) return;
    waiting.delete(packet.id);
    clearTimeout(waiter.timeout);
    packet.error ? waiter.reject(new Error("Chrome command failed")) : waiter.resolve(packet.result);
  };
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++index;
        const timeout = setTimeout(() => { waiting.delete(id); reject(new Error("Chrome command timeout")); }, 30000);
        waiting.set(id, { resolve, reject, timeout });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { ws.close(); },
  };
}
async function evaluate(expression) {
  const result = await channel.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error("Private browser evaluation error");
  return result.result?.value;
}
async function visit(path) {
  await channel.send("Page.navigate", { url: origin + path });
  for (let i = 0; i < 100; i++) {
    const ready = await evaluate('document.readyState === "complete"');
    if (ready) return;
    await sleep(150);
  }
  throw new Error("Private browser navigation timeout");
}
async function waitForWorkspace(path) {
  for (let i = 0; i < 140; i++) {
    const state = await evaluate('({path:location.pathname, ready:document.readyState==="complete", rail:!!document.querySelector(".app-sidebar"), main:!!document.querySelector("#app-main-content")})');
    // The unsigned shell also renders .app-sidebar. Require account UI
    // that is rendered only when the real server-side auth.getUser succeeds.
    const authenticated = await evaluate('({account:!!document.querySelector("a.app-account-link"),signout:!!document.querySelector("form.app-signout-form"),signin:!!document.querySelector("a.app-auth-entry-link")})');
    if (state?.ready && state?.path === path && state.rail && state.main &&
        authenticated?.account && authenticated.signout && !authenticated.signin) return;
    if (state?.path?.startsWith("/auth/sign-in") && i > 45) break;
    await sleep(200);
  }
  throw new Error("AUTHENTICATED_STUDIO_UAT_BLOCKED: actual staff workspace not reachable from QA session");
}
async function signIn() {
  await visit("/auth/sign-in");
  // Do not interpolate credentials into logs or URLs. Native setter fires React inputs.
  const setFields = JSON.stringify({ email, password, next: "/app/" + encodeURIComponent(slug) + "/overview" });
  const form = await evaluate('(() => { const p=' + setFields + ';' +
    'const e=document.querySelector("#sign-in-email"),s=document.querySelector("#sign-in-password");' +
    'const f=e?.closest("form"),next=f?.querySelector("input[name=next]");if(!e||!s||!f||!next)return false;' +
    'const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;' +
    'for(const [field,value] of [[e,p.email],[s,p.password]]){setter.call(field,value);field.dispatchEvent(new Event("input",{bubbles:true}));field.dispatchEvent(new Event("change",{bubbles:true}));}' +
    'next.value=p.next;f.requestSubmit();return true;})()');
  if (!form) throw new Error("AUTHENTICATED_STUDIO_UAT_BLOCKED: real login form unavailable");
  await waitForWorkspace("/app/" + encodeURIComponent(slug) + "/overview");
}
function luminance(rgb) {
  const values = String(rgb).replace(/[^0-9.,]/g, "").split(",").slice(0, 3).map(Number);
  return values.map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
    .reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
try {
  channel = await connect(await launch());
  await channel.send("Page.enable");
  await channel.send("Runtime.enable");
  await channel.send("Emulation.setEmulatedMedia", { features: [{ name:"prefers-reduced-motion", value:"reduce" }] });
  await signIn();
  for (const width of widths) {
    const height = width <= 390 ? 812 : 900;
    await channel.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await visit("/app/" + encodeURIComponent(slug) + "/overview");
    await waitForWorkspace("/app/" + encodeURIComponent(slug) + "/overview");
    const result = await evaluate('(() => {' +
      'const rail=document.querySelector(".app-sidebar"),drawer=document.querySelector(".app-mobile-nav"),link=rail.querySelector("a.app-nav-link");' +
      'const visible=el=>{if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=="hidden";};' +
      'return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,rail:visible(rail),menu:visible(drawer),' +
      'active:document.querySelectorAll(".app-sidebar [aria-current=page]").length,' +
      'count:rail.querySelectorAll("a.app-nav-link").length,' +
      'background:getComputedStyle(rail).backgroundColor,link:getComputedStyle(link).color,' +
      'icon:getComputedStyle(link.querySelector(".app-nav-icon")).color,' +
      'box:rail.getBoundingClientRect().toJSON(),height:rail.clientHeight,scrollHeight:rail.scrollHeight,' +
      'unavailable:(document.querySelector("#app-main-content")?.textContent||"").includes("Current workspace activity could not be loaded.")}})()');
    if (result.unavailable) throw new Error("AUTHENTICATED_OVERVIEW_REAL_WORKSPACE_SNAPSHOT_UNAVAILABLE");
    if (result.width !== width || result.documentWidth > width + 2) throw new Error("Authenticated viewport overflow");
    if (width > 900) {
      if (!result.rail || result.menu || result.count !== 13 || result.active !== 1 || result.box.width < 240 ||
        result.height > height + 1 || contrast(result.link, "#ffffff") < 4.5 ||
        contrast(result.icon, "#ffffff") < 4.5) throw new Error("Authenticated desktop rail visibility failed");
      const expanded = await evaluate('(() => {const d=document.querySelector(".app-sidebar details.app-more-tools");d.querySelector("summary").click();return {open:d.open,count:d.querySelectorAll("a.app-nav-link").length};})()');
      if (!expanded.open || expanded.count !== 4) throw new Error("Authenticated More tools disclosure failed");
    } else {
      if (result.rail || !result.menu) throw new Error("Authenticated mobile workspace nav missing");
      const menu = await evaluate('(() => {const d=document.querySelector(".app-mobile-nav");d.querySelector("summary").click();const panel=d.querySelector(".app-mobile-nav-panel"),r=panel.getBoundingClientRect();return {open:d.open,links:panel.querySelectorAll("a.app-nav-link").length,left:r.left,right:r.right,dialog:panel.getAttribute("aria-modal")};})()');
      if (!menu.open || menu.links !== 13 || menu.left < -2 || menu.right > width+2 || menu.dialog !== "true")
        throw new Error("Authenticated mobile workspace drawer failed");
      const closed = await evaluate('(() => {const d=document.querySelector(".app-mobile-nav");d.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));return !d.open;})()');
      if (!closed) throw new Error("Authenticated drawer Escape failed");
    }
    const screenshot = await channel.send("Page.captureScreenshot", { format:"png", fromSurface:true, captureBeyondViewport:false });
    const png = Buffer.from(screenshot.data || "", "base64");
    if (png.subarray(0,8).toString("hex") !== "89504e470d0a1a0a" || png.readUInt32BE(16) !== width) {
      throw new Error("Authenticated screenshot failed validation");
    }
    writeFileSync(join(output, "authenticated-studio-" + width + ".png"), png, { mode:0o600 });
    report.push({ width, module: "overview", realAuthenticatedSession: true, staffShell: "visible", screenshot: true });
    // Visit EVERY protected Studio module with the same real authenticated
    // owner, not a standalone synthetic shell. No business actions or writes.
    for (const staffModule of staffModules.filter(item => item !== "overview")) {
      const target = "/app/" + encodeURIComponent(slug) + "/" + staffModule;
      await visit(target);
      await waitForWorkspace(target);
      const audit = await evaluate('(() => {' +
        'const rail=document.querySelector(".app-sidebar"),main=document.querySelector("#app-main-content");' +
        'const links=[...document.querySelectorAll(".app-sidebar a.app-nav-link")];' +
        'const selected=links.filter(x=>x.getAttribute("aria-current")==="page");' +
        'const active=selected[0];const m=document.querySelector("details.app-more-tools");' +
        'const text=[...main.querySelectorAll("h1,h2")].map(x=>x.textContent?.trim()).filter(Boolean);' +
        'return {route:location.pathname,width:innerWidth,documentWidth:document.documentElement.scrollWidth,' +
        'signedIn:!!document.querySelector("form.app-signout-form")&&!document.querySelector("a.app-auth-entry-link"),' +
        'navCount:links.length,activeCount:selected.length,activeText:active?.textContent?.trim()||"",moreOpen:m?.open,' +
        'mainVisible:main.getBoundingClientRect().width>0,headerCount:text.length,' +
        'unavailable:text.includes("Workspace unavailable")||text.includes("Staff sign-in required"),' +
        'errorOverlay:!!document.querySelector("nextjs-portal [data-nextjs-dialog-overlay]")};})()');
      if (audit.route !== target || audit.width !== width || audit.documentWidth > width + 2 ||
          !audit.signedIn || audit.navCount !== 13 || audit.activeCount !== 1 ||
          !audit.mainVisible || !audit.headerCount || audit.errorOverlay || audit.unavailable)
        throw new Error("AUTHENTICATED_STUDIO_ROUTE_AUDIT_FAILED:" + staffModule + ":" + width);
      if (["quality","reports","settings","billing"].includes(staffModule) && !audit.moreOpen)
        throw new Error("AUTHENTICATED_DEEP_LINK_SECONDARY_NAV_HIDDEN:" + staffModule);
      // Limit the private screenshot count while auditing 91 real route-width
      // combinations; no customer data is written to Git or public logs.
      if (width === 320 || width === 1440) {
        const capture = await channel.send("Page.captureScreenshot", {format:"png",fromSurface:true,captureBeyondViewport:false});
        const png = Buffer.from(capture.data || "", "base64");
        if (png.subarray(0,8).toString("hex") !== "89504e470d0a1a0a" ||
            png.readUInt32BE(16) !== width) throw new Error("AUTHENTICATED_STUDIO_SCREENSHOT_INVALID");
        writeFileSync(join(output, "private-" + staffModule + "-" + width + ".png"), png, {mode:0o600});
      }
      report.push({width,module:staffModule,realAuthenticatedSession:true,activeNav:true,overflow:false});
    }
  }
  writeFileSync(join(output,"manifest.json"), JSON.stringify({
    status:"REAL_AUTHENTICATED_STAGING_STUDIO_UX_VERIFIED_ONLY",
    providerVerified:false, productionReady:false,
    checks:report,
  },null,2),{mode:0o600});
  console.log("REAL_AUTHENTICATED_STAGING_STUDIO_UX_VERIFIED_ONLY: thirteen routes at seven widths passed; protected private owner session, no provider proof");
} finally {
  channel?.close();
  child?.kill();
  try { rmSync(profile,{recursive:true,force:true,maxRetries:12,retryDelay:150}); } catch { /* Chrome teardown */ }
}
