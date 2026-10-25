#!/usr/bin/env node
/**
 * Read-only next-batch resolver. Run from this planning branch:
 *   node scripts/delivery/next-batch.mjs F
 *   node scripts/delivery/next-batch.mjs P
 * GITHUB_TOKEN (or GH_TOKEN) is optional for public repo API reads.
 * Never closes issues, merges PRs, contacts providers or changes database state.
 */
import { readFileSync } from "node:fs";

const track = process.argv[2]?.trim().toUpperCase();
if (!["F", "P"].includes(track)) {
  console.error("Usage: node scripts/delivery/next-batch.mjs F|P");
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(
  new URL("../../docs/delivery/BATCH_MANIFEST.json", import.meta.url), "utf8"));
const queue = track === "F" ? manifest.feature : manifest.production;
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: "Bearer " + token } : {}),
};
const request = async (path) => {
  const response = await fetch("https://api.github.com/repos/" +
    manifest.repository + path, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error("GitHub read failed (" + response.status + ") for " + path);
  return response.json();
};
const check = (issue) => {
  const lines = issue.body?.match(/^\s*- \[[ xX]\] /gm) ?? [];
  const unchecked = issue.body?.match(/^\s*- \[ \] /gm) ?? [];
  const signoff = /BATCH_DONE_VERIFIED:\s*[0-9a-f]{40}\b/i.test(issue.body ?? "");
  const completed = issue.state === "closed" &&
    lines.length >= 2 && unchecked.length === 0 && signoff;
  return { completed, boxes: lines.length, remaining: unchecked.length,
    signoff, state: issue.state };
};
try {
  const ref = await request("/git/ref/heads/" + manifest.canonical_branch);
  const head = ref.object?.sha || "UNKNOWN";
  for (const batch of queue) {
    const issue = await request("/issues/" + batch.issue);
    const status = check(issue);
    if (status.completed) continue;
    const badClosed = status.state === "closed";
    console.log(JSON.stringify({
      program: manifest.program, track, next_batch: batch.id,
      issue: issue.html_url, current_canonical_sha: head,
      status: badClosed ? "INCONSISTENT_CLOSED_ISSUE" : "PENDING_OR_BLOCKED",
      ...status,
      rule: "Resume this batch. Never skip; close only after checked tasks and exact-SHA verification.",
    }, null, 2));
    if (badClosed) process.exitCode = 3;
    process.exit();
  }
  console.log(JSON.stringify({ program: manifest.program, track,
    status: "ALL_BATCHES_VERIFIED_COMPLETE", current_canonical_sha: head }, null, 2));
} catch (error) {
  console.error("BATCH_SELECTOR_FAILED: " + String(error?.message || error));
  process.exitCode = 1;
}
