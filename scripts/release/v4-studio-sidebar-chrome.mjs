#!/usr/bin/env node
/**
 * Real-Chrome synthetic-only StaffAppShell sidebar QA.
 * Expects a CI-generated temporary /studio-navigation-qa route; that route is
 * not part of the committed application or deployed product. No auth/session
 * cookies, external services, tenant data or real staff navigation is used.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const chrome = process.env.V4_SIDEBAR_CHROME;
if (!chrome || !existsSync(chrome) || !statSync(chrome).isFile()) {
  throw new Error("V4_SIDEBAR_CHROME must point to installed Chrome.");
}
const origin = "http://127.0.0.1:3000";
const path = "/studio-navigation-qa";
const widths = [320, 390, 834, 901, 1024, 1280, 1440];
const output = resolve(process.env.V4_SIDEBAR_OUTPUT || join(tmpdir(), "servicedesk-sidebar-chrome"));
const root = resolve(process.cwd());
if (output === root || output.startsWith(root + "/") || existsSync(output)) {
  throw new Error("Screenshot output must be a fresh directory outside source control.");
}
mkdirSync(output, { mode: 0o700, recursive: true });
const profile = mkdtempSync(join(tmpdir(), "sd-v4-sidebar-profile-"));
let child;
let channel;

function contrast(foreground, background = "#ffffff") {
  function luminance(color) {
    const channels = color.startsWith("#")
      ? [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16))
      : (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    if (channels.length !== 3) return 0;
    return channels.map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
      .reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
  }
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
async function launch() {
  child = spawn(chrome, [
    "--headless=new", "--no-first-run", "--disable-extensions",
    "--disable-background-networking", "--disable-dev-shm-usage",
    "--no-sandbox", "--disable-setuid-sandbox", "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=9227", "--user-data-dir=" + profile,
    "--window-size=1440,900", "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error("Chrome exited early.");
    try {
      const response = await fetch("http://127.0.0.1:9227/json/list", { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        const list = await response.json();
        const tab = list.find(entry => entry.type === "page" && entry.webSocketDebuggerUrl);
        if (tab) return tab.webSocketDebuggerUrl;
      }
    } catch { /* Chrome not started */ }
    await sleep(150);
  }
  throw new Error("Chrome CDP not available on isolated loopback.");
}
async function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  let id = 0;
  await new Promise((ok, fail) => {
    const timer = setTimeout(() => fail(new Error("CDP socket connection timed out")), 12000);
    ws.onopen = () => { clearTimeout(timer); ok(); };
    ws.onerror = () => { clearTimeout(timer); fail(new Error("CDP socket failed")); };
  });
  ws.onmessage = event => {
    const packet = JSON.parse(String(event.data));
    const item = pending.get(packet.id);
    if (!item) return;
    pending.delete(packet.id);
    clearTimeout(item.timer);
    if (packet.error) item.fail(new Error(packet.error.message));
    else item.ok(packet.result);
  };
  return {
    send(method, params = {}) {
      return new Promise((ok, fail) => {
        const num = ++id;
        const timer = setTimeout(() => {
          pending.delete(num);
          fail(new Error("CDP timed out: " + method));
        }, 30000);
        pending.set(num, { ok, fail, timer });
        ws.send(JSON.stringify({ id: num, method, params }));
      });
    },
    close() { ws.close(); },
  };
}
async function evalInPage(expression) {
  const result = await channel.send("Runtime.evaluate", {
    expression, awaitPromise: true, returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error("Browser script failed: " +
    String(result.exceptionDetails.exception?.description || result.exceptionDetails.text).slice(0, 250));
  return result.result?.value;
}
async function ready() {
  for (let i = 0; i < 100; i++) {
    const state = await evalInPage('(() => ({path:location.pathname,ready:document.readyState === "complete",' +
      'sidebar:!!document.querySelector(".app-sidebar"),header:!!document.querySelector(".app-topbar"),' +
      'heading:document.querySelector("#app-main-content h1")?.textContent || ""}))()');
    if (state?.path === path && state.ready && state.sidebar && state.header &&
        state.heading.includes("Synthetic Sidebar Contrast QA")) return;
    await sleep(120);
  }
  throw new Error("Isolated real StaffAppShell fixture did not render.");
}
const reports = [];
try {
  const route = await fetch(origin + path, { redirect: "manual" });
  if (route.status !== 200) throw new Error("Synthetic-only temporary QA page missing: HTTP " + route.status);
  channel = await connect(await launch());
  await channel.send("Page.enable");
  await channel.send("Runtime.enable");
  await channel.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  for (const width of widths) {
    const height = width <= 390 ? 812 : 900;
    await channel.send("Emulation.setDeviceMetricsOverride", {
      width, height, deviceScaleFactor: 1, mobile: false,
    });
    await channel.send("Page.navigate", { url: origin + path });
    await ready();
    const result = await evalInPage('(() => {' +
      'const rail=document.querySelector(".app-sidebar");const mobile=document.querySelector(".app-mobile-nav");' +
      'const sidebarLink=rail.querySelector("a.app-nav-link");const icon=sidebarLink?.querySelector(".app-nav-icon");' +
      'const group=rail.querySelector(".app-nav-label");const disclosure=rail.querySelector("details summary");' +
      'const caption=rail.querySelector(".app-product-caption");const styles=el=>el?getComputedStyle(el):null;' +
      'const visible=el=>{if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&styles(el).visibility!=="hidden";};' +
      'const box=el=>el?{x:el.getBoundingClientRect().x,width:el.getBoundingClientRect().width}:null;' +
      'return {width:innerWidth,body:document.body.scrollWidth,root:document.documentElement.scrollWidth,' +
      'reduced:matchMedia("(prefers-reduced-motion: reduce)").matches,sidebarVisible:visible(rail),' +
      'mobileVisible:visible(mobile),railBackground:styles(rail)?.backgroundImage||"",'+
      'railWidth:box(rail),linkVisible:visible(sidebarLink),linkColor:styles(sidebarLink)?.color||"",'+
      'iconColor:styles(icon)?.color||"",groupColor:styles(group)?.color||"",'+
      'disclosureColor:styles(disclosure)?.color||"",captionColor:styles(caption)?.color||"",'+
      'linkCount:rail.querySelectorAll("a.app-nav-link").length};})()');
    if (result.width !== width || !result.reduced || Math.max(result.body, result.root) > width + 2) {
      throw new Error("Viewport overflow or reduced-motion failure: " + width + " " + JSON.stringify(result));
    }
    if (width > 900) {
      if (!result.sidebarVisible || result.mobileVisible || result.linkCount !== 13 ||
          !result.linkVisible || !result.railBackground.includes("linear-gradient") ||
          result.railWidth.width < 240) {
        throw new Error("Desktop sidebar missing or unexpectedly styled: " + width + " " + JSON.stringify(result));
      }
      for (const property of ["linkColor", "iconColor", "groupColor", "disclosureColor", "captionColor"]) {
        if (contrast(result[property]) < 4.5) {
          throw new Error("Desktop sidebar unreadable " + property + ": " + width + " " + result[property] +
            " (" + contrast(result[property]).toFixed(2) + ":1)");
        }
      }
      const selected = await evalInPage('(() => {' +
        'const nav=document.querySelector(".app-sidebar a.app-nav-link");nav.setAttribute("aria-current","page");' +
        'const cs=getComputedStyle(nav);const icon=getComputedStyle(nav.querySelector(".app-nav-icon"));' +
        'return{color:cs.color,background:cs.backgroundColor,icon:icon.color,marker:cs.boxShadow};})()');
      if (contrast(selected.color, selected.background) < 4.5 ||
          contrast(selected.icon, selected.background) < 4.5 ||
          !selected.marker.includes("inset")) {
        throw new Error("Active desktop nav is unreadable: " + width + " " + JSON.stringify(selected));
      }
      const more = await evalInPage('(() => {' +
        'const d=document.querySelector(".app-sidebar details");const s=d.querySelector("summary");s.click();' +
        'return {open:d.open,links:d.querySelectorAll("a.app-nav-link").length,' +
        'visible:getComputedStyle(s).color,selected:d.querySelector("a.app-nav-link")?.getBoundingClientRect().height};})()');
      if (!more.open || more.links !== 5 || more.selected < 40 || contrast(more.visible) < 4.5) {
        throw new Error("More tools links hidden: " + width + " " + JSON.stringify(more));
      }
    } else {
      if (result.sidebarVisible || !result.mobileVisible) {
        throw new Error("Mobile layout did not switch to navigation disclosure: " + width);
      }
      const drawer = await evalInPage('(() => {' +
        'const d=document.querySelector(".app-mobile-nav");d.querySelector("summary").click();' +
        'const links=d.querySelector(".app-mobile-links");const r=links.getBoundingClientRect();' +
        'const nav=links.querySelector("a.app-nav-link");const c=getComputedStyle(nav);' +
        'const group=links.querySelector(".app-nav-label");' +
        'const mark=nav.querySelector(".app-nav-icon");const a=nav.getBoundingClientRect();' +
        'return {open:d.open,links:links.querySelectorAll("a.app-nav-link").length,' +
        'left:r.left,right:r.right,navHeight:a.height,navColor:c.color,' +
        'iconColor:getComputedStyle(mark).color,groupColor:getComputedStyle(group).color};})()');
      if (!drawer.open || drawer.links !== 13 || drawer.left < -2 || drawer.right > width + 2 ||
          drawer.navHeight < 44 || contrast(drawer.navColor) < 4.5 ||
          contrast(drawer.groupColor) < 4.5 || contrast(drawer.iconColor) < 4.5) {
        throw new Error("Mobile sidebar drawer visibility failure: " + width + " " + JSON.stringify(drawer));
      }
    }
    await sleep(90);
    const screenshot = await channel.send("Page.captureScreenshot", {
      format: "png", fromSurface: true, captureBeyondViewport: false,
    });
    const png = Buffer.from(screenshot.data || "", "base64");
    if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
        png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height) {
      throw new Error("Invalid real screenshot: " + width);
    }
    writeFileSync(join(output, "studio-sidebar-" + width + ".png"), png, { mode: 0o600 });
    reports.push({ width, sidebar: width > 900 ? "visible" : "mobile-menu", contrastChecked: true,
      horizontalOverflow: false, realChrome: true, syntheticOnly: true });
  }
  writeFileSync(join(output, "manifest.json"), JSON.stringify({
    status: "SYNTHETIC_STAFF_SHELL_BROWSER_VERIFIED_NOT_AUTHENTICATED_UAT",
    checkout: process.env.V4_SIDEBAR_SHA || null, reports,
  }, null, 2), { mode: 0o600 });
  console.log("Actual Chrome: " + reports.length +
    " synthetic staff shell screenshots. Nav contrast, active/expanded tools, mobile drawer PASS.");
} finally {
  channel?.close();
  child?.kill();
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 12, retryDelay: 150 }); } catch { /* Chrome may still exit */ }
}
