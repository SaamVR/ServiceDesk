#!/usr/bin/env node
/**
 * Actual Chrome screenshots of PUBLIC pages only. No credentials, cookies,
 * tenant/workspace routes, or provider traffic. Not staff visual acceptance.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const pages = [
  { slug: "home", path: "/", title: "Run cleaning operations from enquiry to paid job." },
  { slug: "features", path: "/features", title: "Everything a cleaning operations team needs to move work forward." },
  { slug: "pricing", path: "/pricing", title: "Pricing stays rule-based, versioned and auditable." },
  { slug: "integrations", path: "/integrations", title: "Connect the systems your operation already uses." },
  { slug: "contact", path: "/contact", title: "See ServiceDesk against your real cleaning workflow." },
  { slug: "sign-in", path: "/auth/sign-in", title: "Ready for what's next?" },
];
const widths = [320, 390, 834, 1280, 1440];
const height = (width) => width <= 390 ? 812 : 900;
const origin = "http://127.0.0.1:3000";
const chrome = process.env.V3_PUBLIC_CHROME;
if (!chrome || !existsSync(chrome) || !statSync(chrome).isFile()) {
  throw new Error("V3_PUBLIC_CHROME must point to Chrome.");
}
const root = resolve(process.cwd());
const output = resolve(process.env.V3_PUBLIC_OUTPUT || join(tmpdir(), "servicedesk-v3-public-proof"));
if (output === root || output.startsWith(root + "/") || existsSync(output)) {
  throw new Error("Browser evidence must use a fresh directory outside Git.");
}
mkdirSync(output, { recursive: true, mode: 0o700 });
const profile = mkdtempSync(join(tmpdir(), "servicedesk-public-chrome-"));
let child;
let channel;

async function launch() {
  child = spawn(chrome, [
    "--headless=new", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--disable-background-networking", "--disable-dev-shm-usage",
    "--no-sandbox", "--disable-setuid-sandbox",
    "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=9222",
    "--user-data-dir=" + profile,
    "--window-size=1440,900", "about:blank",
  ], { stdio: "ignore" });
  // Chrome-for-Testing releases may omit DevToolsActivePort on Linux. A fixed
  // loopback-only port is reliable in this ephemeral, credential-free CI job.
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error("Chrome exited early.");
    try {
      const response = await fetch("http://127.0.0.1:9222/json/list");
      if (response.ok) {
        const tabs = await response.json();
        const tab = tabs.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
        if (tab) return tab.webSocketDebuggerUrl;
      }
    } catch { /* Browser is still opening. */ }
    await sleep(150);
  }
  throw new Error("Chrome DevTools did not become ready on loopback port 9222.");
}
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 0;
  await new Promise((ok, fail) => {
    const timer = setTimeout(() => fail(new Error("Chrome websocket timed out.")), 10000);
    ws.onopen = () => { clearTimeout(timer); ok(); };
    ws.onerror = () => { clearTimeout(timer); fail(new Error("Chrome websocket failed.")); };
  });
  ws.onmessage = (event) => {
    const packet = JSON.parse(String(event.data));
    const active = pending.get(packet.id);
    if (!active) return;
    clearTimeout(active.timer);
    pending.delete(packet.id);
    if (packet.error) active.reject(new Error(packet.error.message));
    else active.resolve(packet.result);
  };
  return {
    send(method, params = {}) {
      return new Promise((ok, fail) => {
        const id = ++nextId;
        const timer = setTimeout(() => {
          pending.delete(id);
          fail(new Error("Chrome command timeout: " + method));
        }, 20000);
        pending.set(id, { resolve: ok, reject: fail, timer });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => ws.close(),
  };
}
async function inspect(expression) {
  const result = await channel.send("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error("Chrome page inspection failed.");
  return result.result?.value;
}
async function loaded(page) {
  for (let i = 0; i < 100; i++) {
    try {
      const state = await inspect(
        '(() => ({path: location.pathname,ready: document.readyState === "complete",' +
        'main:!!document.querySelector("main"),' +
        'heading:document.querySelector("main h1")?.textContent?.trim()?.replace(/\\s+/g," ") || "",' +
        'overlay:!!document.querySelector("nextjs-portal [data-nextjs-dialog-overlay]")}))()'
      );
      // A generic Next shell/error page is not proof of the requested product
      // route; verify the route's actual authored H1 before capturing a PNG.
      if (state?.path === page.path && state.ready && state.main &&
          state.heading === page.title && !state.overlay) return;
    } catch { /* Navigation invalidated the previous execution context. */ }
    await sleep(120);
  }
  throw new Error("Public page did not render the expected product heading: " + page.slug);
}
async function snapshot(page, width, type) {
  const data = await channel.send("Page.captureScreenshot", {
    format: "png", fromSurface: true, captureBeyondViewport: false,
  });
  const png = Buffer.from(data.data ?? "", "base64");
  if (png.length <= 24 || png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
      png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height(width)) {
    throw new Error("Chrome screenshot dimensions invalid: " + page.slug + " " + width);
  }
  const file = page.slug + "-" + width + "-" + type + ".png";
  writeFileSync(join(output, file), png, { mode: 0o600 });
  return { page: page.slug, width, type, file };
}
async function layoutCheck(page, width) {
  const state = await inspect(
    '(() => ({width:innerWidth,height:innerHeight,body:document.body.scrollWidth,' +
    'root:document.documentElement.scrollWidth,' +
    'reduced:matchMedia("(prefers-reduced-motion: reduce)").matches,' +
    'heading:document.querySelector("main h1")?.textContent?.trim()?.length || 0,' +
    'links:document.querySelectorAll("a[href]").length,' +
    'passwords:document.querySelectorAll("input[type=password]").length}))()'
  );
  if (state.width !== width || state.height !== height(width) || !state.reduced) {
    throw new Error("Chrome viewport/reduced-motion mismatch: " + page.slug + " " + width);
  }
  if (Math.max(state.body, state.root) > width + 2) {
    throw new Error("Public horizontal overflow: " + page.slug + " " + width +
      " (" + Math.max(state.body, state.root) + ")");
  }
  if (state.heading < 4 || state.links < 1 ||
      (page.slug === "sign-in" && state.passwords !== 1)) {
    throw new Error("Public page is missing visible content/form controls: " + page.slug);
  }
  return { page: page.slug, width, links: state.links, horizontalOverflow: false };
}

const captures = [];
const layout = [];
try {
  for (const page of pages) {
    const response = await fetch(origin + page.path, { redirect: "manual" });
    if (response.status !== 200) {
      throw new Error("Public route HTTP " + response.status + ": " + page.path);
    }
  }
  channel = await connect(await launch());
  await channel.send("Page.enable");
  await channel.send("Runtime.enable");
  await channel.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  for (const width of widths) {
    await channel.send("Emulation.setDeviceMetricsOverride", {
      width, height: height(width), deviceScaleFactor: 1,
      mobile: width <= 390, screenWidth: width, screenHeight: height(width),
    });
    for (const page of pages) {
      const navigation = await channel.send("Page.navigate", { url: origin + page.path });
      if (navigation.errorText) throw new Error("Public navigation failed: " + page.slug);
      await loaded(page);
      await inspect("document.fonts.ready.then(() => true)");
      await sleep(120);
      layout.push(await layoutCheck(page, width));
      captures.push(await snapshot(page, width, "first-fold"));
      await inspect('(() => {window.scrollTo({top:Math.floor((document.documentElement.scrollHeight-innerHeight)/2),behavior:"instant"});return true;})()');
      await sleep(100);
      captures.push(await snapshot(page, width, "mid-page"));
    }
  }
  writeFileSync(join(output, "manifest.json"), JSON.stringify({
    status: "PUBLIC_ONLY_BROWSER_CAPTURED_NOT_STAFF_ACCEPTED",
    pages: pages.map((page) => page.path), widths, captures, layout,
    reducedMotion: true,
    checkedOutSha: process.env.V3_PUBLIC_CHECKOUT_SHA || null,
    capturedAt: new Date().toISOString(),
  }, null, 2), { mode: 0o600 });
  console.log("Actual Chrome: " + captures.length + " PUBLIC screenshots / " +
    layout.length + " responsive checks. No authenticated staff proof.");
} finally {
  channel?.close();
  child?.kill();
  rmSync(profile, { recursive: true, force: true });
}
