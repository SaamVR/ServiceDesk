#!/usr/bin/env node
/**
 * Genuine Chrome interaction test of the synthetic /sandbox route.
 * No credentials, remote providers, database calls or customer data.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

const origin = "https://servicedesk-v3-frontend-review.onrender.com";
const chrome = process.env.V4_LIVE_SANDBOX_CHROME;
if (!chrome || !existsSync(chrome) || !statSync(chrome).isFile()) throw new Error("Chrome binary required.");
const root = resolve(process.cwd());
const output = resolve(process.env.V4_LIVE_SANDBOX_OUTPUT || join(tmpdir(), "servicedesk-live-sandbox"));
if (output === root || output.startsWith(root + "/") || existsSync(output)) {
  throw new Error("Sandbox screenshots must use a fresh external directory.");
}
mkdirSync(output, { recursive: true, mode: 0o700 });
const profile = mkdtempSync(join(tmpdir(), "servicedesk-sandbox-chrome-"));
let child, connection;
const seenExternal = [];
const captures = [];
const widths = [320, 390, 834, 1440];

async function boot() {
  child = spawn(chrome, [
    "--headless=new", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--disable-background-networking",
    "--disable-dev-shm-usage", "--no-sandbox", "--disable-setuid-sandbox",
    "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=9223",
    "--user-data-dir=" + profile, "--window-size=1440,900", "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error("Chrome terminated.");
    try {
      const r = await fetch("http://127.0.0.1:9223/json/list");
      if (r.ok) {
        const tab = (await r.json()).find(x => x.type === "page" && x.webSocketDebuggerUrl);
        if (tab) return tab.webSocketDebuggerUrl;
      }
    } catch { /* starting */ }
    await sleep(180);
  }
  throw new Error("Chrome CDP not available.");
}
async function connect(url) {
  const ws = new WebSocket(url);
  let seq = 0;
  const pending = new Map();
  await new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebSocket connection timed out")), 10000);
    ws.onopen = () => { clearTimeout(timeout); resolveReady(); };
    ws.onerror = () => { clearTimeout(timeout); reject(new Error("WebSocket failed")); };
  });
  ws.onmessage = message => {
    const packet = JSON.parse(String(message.data));
    if (packet.method === "Network.requestWillBeSent") {
      const url = packet.params?.request?.url ?? "";
      if (url.startsWith("http") && !url.startsWith(origin + "/")) seenExternal.push(url.slice(0, 80));
    }
    const item = pending.get(packet.id);
    if (!item) return;
    clearTimeout(item.timeout);
    pending.delete(packet.id);
    if (packet.error) item.reject(new Error(packet.error.message));
    else item.resolve(packet.result);
  };
  return {
    send(method, params = {}) {
      return new Promise((resolveResult, reject) => {
        const id = ++seq;
        const timeout = setTimeout(() => { pending.delete(id); reject(new Error("CDP timeout: " + method)); }, 20000);
        pending.set(id, { resolve: resolveResult, reject, timeout });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { ws.close(); },
  };
}
async function evaluate(expression) {
  const response = await connection.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error("Sandbox Chrome inspection failed.");
  return response.result?.value;
}
async function waitForStage(expected) {
  for (let i = 0; i < 60; i++) {
    try {
      const state = await evaluate('(() => ({stage:document.querySelector(\'section[aria-label="Live simulation totals"] article:last-child strong\')?.textContent?.trim(), ' +
        'heading:document.querySelector("main#sandbox-main h1")?.textContent?.trim(), ' +
        'overlay:!!document.querySelector("nextjs-portal [data-nextjs-dialog-overlay]")}))()');
      if (state?.stage === expected && state.heading === "One job. Every step. Your decisions." && !state.overlay) return;
    } catch { /* context was replaced */ }
    await sleep(150);
  }
  throw new Error("Sandbox stage not rendered: " + expected);
}
async function click(label) {
  for (let attempt = 0; attempt < 35; attempt++) {
    const found = await evaluate('(() => { const el=[...document.querySelectorAll("button")].find(b=>b.textContent?.includes(' +
      JSON.stringify(label) + ')); if (!el || el.disabled) return false; el.click(); return true; })()');
    if (found) return;
    await sleep(130);
  }
  throw new Error("Missing actionable sandbox button: " + label);
}
async function snapshot(width, suffix) {
  const result = await connection.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true });
  const buffer = Buffer.from(result.data || "", "base64");
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
      buffer.readUInt32BE(16) !== width) {
    throw new Error("Invalid screenshot for " + width);
  }
  const file = "sandbox-" + width + "-" + suffix + ".png";
  writeFileSync(join(output, file), buffer, { mode: 0o600 });
  captures.push(file);
}
async function verifyNoOverflow(width) {
  const m = await evaluate('(() => ({inner:innerWidth,root:document.documentElement.scrollWidth,body:document.body.scrollWidth, ' +
    'robots:document.querySelector("meta[name=robots]")?.content||"",buttons:document.querySelectorAll("button").length}))()');
  if (m.inner !== width || Math.max(m.root, m.body) > width + 2 || !m.robots.includes("noindex") || m.buttons < 2) {
    throw new Error("Sandbox responsive safety failure: " + width + " " + JSON.stringify(m));
  }
}
async function totals() {
  return evaluate('(() => [...document.querySelectorAll(\'section[aria-label="Live simulation totals"] article\')].map(x=>x.querySelector("strong")?.textContent?.trim()))()');
}
try {
  const response = await fetch(origin + "/sandbox", { redirect: "manual" });
  if (response.status !== 200) throw new Error("Sandbox route HTTP " + response.status);
  connection = await connect(await boot());
  await connection.send("Page.enable");
  await connection.send("Runtime.enable");
  await connection.send("Network.enable");
  await connection.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  const navigate = await connection.send("Page.navigate", { url: origin + "/sandbox" });
  if (navigate.errorText) throw new Error("Sandbox browser navigation failed.");
  await waitForStage("New enquiry");
  await sleep(650); // Allow React client hydration before the first click.
  for (const width of widths) {
    await connection.send("Emulation.setDeviceMetricsOverride", {
      width, height: width <= 390 ? 812 : 900, deviceScaleFactor: 1,
      mobile: width <= 390, screenWidth: width, screenHeight: width <= 390 ? 812 : 900,
    });
    await sleep(180);
    await verifyNoOverflow(width);
    await snapshot(width, "initial");
  }
  const steps = [
    ["Prepare sample quote", "Quote prepared"],
    ["Simulate quote acceptance", "Quote accepted"],
    ["Hold a sample crew slot", "Capacity held"],
    ["Simulate deposit payment", "Deposit recorded"],
    ["Assign Crew Alpha", "Crew assigned"],
    ["Start sample job", "Work in progress"],
    ["Complete and review job", "Completion reviewed"],
    ["Simulate balance payment", "Balance recorded"],
  ];
  for (const [action, expectedStage] of steps) {
    await click(action);
    await waitForStage(expectedStage);
    if (expectedStage === "Deposit recorded") {
      await click("Queue confirmation");
      await click("Inject mock failure");
      let state = await evaluate('document.body.innerText.includes("Mock provider failure")');
      if (!state) throw new Error("Mock failure was not shown.");
      await click("Retry failed send");
      await click("Accept in mock transport");
      state = await evaluate('document.body.innerText.includes("Mock provider accepted · not delivered")');
      if (!state) throw new Error("Sandbox claimed delivery after mock acceptance.");
    }
  }
  const ending = await totals();
  if (ending[0] !== "$340" || ending[1] !== "$340" || ending[2] !== "$0" || ending[3] !== "Balance recorded") {
    throw new Error("Sandbox final ledger invariant failed: " + JSON.stringify(ending));
  }
  await snapshot(1440, "completed");
  await click("Reset sandbox");
  await waitForStage("New enquiry");
  const reset = await totals();
  if (reset[1] !== "$0" || reset[2] !== "$340") throw new Error("Reset did not restore zero payments.");
  const unexpected = seenExternal.filter(url => ![
    "https://fonts.googleapis.com/", "https://fonts.gstatic.com/", "https://images.unsplash.com/"
  ].some(allowed => url.startsWith(allowed)));
  if (unexpected.length) throw new Error("Unexpected external request during synthetic flow: " + JSON.stringify(unexpected));
  writeFileSync(join(output, "manifest.json"), JSON.stringify({
    status: "SYNTHETIC_BROWSER_PROVEN_NOT_CONNECTED_PROVIDER",
    screenshots: captures, widths, stages: steps.length + 1,
    origin, finalLedger: ending, resetLedger: reset, unexpectedExternalRequests: unexpected.length,
  }, null, 2), { mode: 0o600 });
  console.log("PASS deployed Render sandbox actual Chrome: " + captures.length + " screenshots, 9 stages, mock failure/retry, final ledger, reset, no external requests");
} finally {
  connection?.close();
  child?.kill();
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 12, retryDelay: 200 }); }
  catch (error) { console.warn("Ephemeral Chrome profile cleanup:", error?.code || "unknown"); }
}
