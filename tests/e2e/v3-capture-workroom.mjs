#!/usr/bin/env node
/**
 * Capture actual tenant-authorized nonproduction UI. Screenshots may contain
 * personal data: keep them offline, outside Git, and out of CI logs.
 * An operator-supplied SHA is NOT proof of what the preview deployed.
 *
 * V3_QA_ISOLATED=1 V3_QA_BASE_URL=https://approved-preview.example
 * V3_QA_WORKSPACE=isolated-qa V3_QA_PROFILE_DIR=/secure/qa-chrome
 * V3_QA_EXPECTED_SHA=<full_git_sha> node tests/e2e/v3-capture-workroom.mjs
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

function input(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("Required isolated QA setting missing: " + name);
  return value;
}
if (input("V3_QA_ISOLATED") !== "1") throw new Error("Isolated QA permission required.");
const base = new URL(input("V3_QA_BASE_URL"));
if (!["http:", "https:"].includes(base.protocol) ||
    (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) ||
    base.pathname !== "/" || base.username || base.password || base.search || base.hash) {
  throw new Error("Use HTTPS preview origin or localhost, without credentials or query parameters.");
}
const workspace = input("V3_QA_WORKSPACE");
const sourceSha = input("V3_QA_EXPECTED_SHA");
if (!/^[a-f0-9]{40}$/i.test(sourceSha)) throw new Error("Expected SHA must be 40 hexadecimal characters.");
const profile = resolve(input("V3_QA_PROFILE_DIR"));
const executable = process.env.V3_QA_CHROMIUM || "/usr/bin/chromium";
if (!existsSync(profile) || !statSync(profile).isDirectory() || !existsSync(executable)) {
  throw new Error("An existing QA browser profile and Chromium binary are required.");
}
const output = resolve(process.env.V3_QA_OUTPUT || join(tmpdir(), "servicedesk-v3-visual-qa"));
const root = resolve(process.cwd());
if (output === root || output.startsWith(root + "/")) throw new Error("Private evidence must stay outside Git.");
mkdirSync(output, { recursive: true });
const modules = ["overview", "inbox", "schedule", "jobs", "requests", "quotes", "customers", "invoices"];
const widths = [320, 390, 834, 1280, 1440];
const screenshots = [];

async function launch() {
  const child = spawn(executable, [
    "--headless=new", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--disable-background-networking",
    "--disable-dev-shm-usage", "--remote-debugging-port=0",
    "--user-data-dir=" + profile, "--window-size=1440,900",
    ...(typeof process.getuid === "function" && process.getuid() === 0 ? ["--no-sandbox"] : []),
    "about:blank",
  ], { stdio: "ignore" });
  const portPath = join(profile, "DevToolsActivePort");
  for (let i = 0; i < 75; i++) {
    if (child.exitCode !== null) throw new Error("Chromium exited without a QA session.");
    if (existsSync(portPath)) {
      const port = Number(readFileSync(portPath, "utf8").split("\n")[0]);
      if (Number.isInteger(port) && port > 0 && port < 65536) {
        try {
          const response = await fetch("http://127.0.0.1:" + port + "/json/list");
          if (response.ok) {
            const tabs = await response.json();
            const tab = tabs.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
            if (tab) return { child, wsUrl: tab.webSocketDebuggerUrl };
          }
        } catch { /* Chrome may have written the port before DevTools is ready. */ }
      }
    }
    await sleep(200);
  }
  child.kill();
  throw new Error("Local Chromium DevTools did not become available.");
}

async function connect(url) {
  const websocket = new WebSocket(url);
  const pending = new Map();
  let nextId = 0;
  await new Promise((resolveOpen, rejectOpen) => {
    const timer = setTimeout(() => rejectOpen(new Error("DevTools connection timed out.")), 10000);
    websocket.onopen = () => { clearTimeout(timer); resolveOpen(); };
    websocket.onerror = () => { clearTimeout(timer); rejectOpen(new Error("DevTools unavailable.")); };
  });
  websocket.onmessage = (event) => {
    const message = JSON.parse(String(event.data));
    const entry = pending.get(message.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(message.id);
    if (message.error) entry.reject(new Error("CDP failed: " + message.error.message));
    else entry.resolve(message.result);
  };
  function send(method, params = {}) {
    return new Promise((resolveCommand, rejectCommand) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        rejectCommand(new Error("DevTools command timed out: " + method));
      }, 20000);
      pending.set(id, { resolve: resolveCommand, reject: rejectCommand, timer });
      websocket.send(JSON.stringify({ id, method, params }));
    });
  }
  return { send, close: () => websocket.close() };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error("Browser failed to evaluate public layout metrics.");
  return result.result?.value;
}
async function authenticatedPage(cdp, path) {
  const expression = '(() => ({ path: location.pathname, ready: document.readyState,' +
    'staff: Boolean(document.getElementById("app-main-content")),' +
    'unauth: Boolean(document.querySelector(".app-auth-entry-link")),' +
    'unavailable: Boolean(document.body?.textContent?.includes("Workspace unavailable")) }))()';
  for (let i = 0; i < 75; i++) {
    const page = await evaluate(cdp, expression);
    if (page?.path?.startsWith("/auth/") || page?.unauth) throw new Error("Staff session is not authenticated.");
    if (page?.unavailable) throw new Error("Tenant staff snapshot is unavailable.");
    if (page?.path === path && page.staff && page.ready === "complete") return;
    await sleep(200);
  }
  throw new Error("Staff route did not finish loading: " + path.split("/").at(-1));
}
function validatePNG(png, width, height) {
  if (png.length < 25 || png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
      png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height) {
    throw new Error("Screenshot does not have the exact verified CDP viewport dimensions.");
  }
}

let browser;
let cdp;
try {
  browser = await launch();
  cdp = await connect(browser.wsUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  for (const module of modules) {
    const path = "/app/" + encodeURIComponent(workspace) + "/" + module;
    await cdp.send("Page.navigate", { url: new URL(path, base).toString() });
    await authenticatedPage(cdp, path);
    for (const width of widths) {
      const height = width <= 390 ? 812 : 900;
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width, height, deviceScaleFactor: 1, mobile: width <= 390,
        screenWidth: width, screenHeight: height,
      });
      await evaluate(cdp, "document.fonts.ready.then(() => true)");
      await sleep(250);
      const layout = await evaluate(cdp,
        '(() => ({ width:innerWidth, height:innerHeight,' +
        'body:document.body.scrollWidth, document:document.documentElement.scrollWidth,' +
        'controls:document.querySelectorAll("a,button,input,select,textarea,summary").length }))()');
      if (layout.width !== width || layout.height !== height) {
        throw new Error("Browser emulation refused required viewport: " + module + " / " + width);
      }
      if (Math.max(layout.body, layout.document) > width + 2) {
        throw new Error("Horizontal overflow at " + module + " / " + width);
      }
      const frame = await cdp.send("Page.captureScreenshot", {
        format: "png", fromSurface: true, captureBeyondViewport: false,
      });
      const png = Buffer.from(frame.data || "", "base64");
      validatePNG(png, width, height);
      const name = module + "-" + width + ".png";
      writeFileSync(join(output, name), png, { mode: 0o600 });
      screenshots.push({ module, width, height, controls: layout.controls, file: name });
    }
  }
  writeFileSync(join(output, "manifest.json"), JSON.stringify({
    status: "CAPTURED_NOT_YET_VISUALLY_ACCEPTED",
    screenshots,
    origin: base.origin,
    operatorSuppliedSourceSha: sourceSha,
    independentlyVerifiedSourceSha: false,
    capturedAt: new Date().toISOString(),
  }, null, 2), { mode: 0o600 });
  console.log("Chromium captured " + screenshots.length +
    " exact-width authenticated screenshots. Visual review and deployed SHA verification remain required.");
} finally {
  cdp?.close();
  browser?.child.kill();
}
