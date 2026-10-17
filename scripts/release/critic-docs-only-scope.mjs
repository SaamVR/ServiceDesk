#!/usr/bin/env node
/**
 * Fail-closed classifier for the mandatory PR source gate.
 * A critic Markdown-only change can use the fast source-check path, but the
 * job itself must still run and conclude, preserving branch protection.
 *
 * Input is git's NUL-delimited --name-only -z output from merge-base to
 * the exact PR head. No branch names, API tokens or user-supplied commands
 * are interpreted.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const criticMarkdown = /^docs\/(?:engineering\/critic|control-tower\/critic)\/(?:[a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+\.md$/;

export function isOnlyCriticMarkdown(changedPaths) {
  return Array.isArray(changedPaths) && changedPaths.length > 0 &&
    changedPaths.every(path => typeof path === "string" && criticMarkdown.test(path) &&
      !path.split("/").includes(".."));
}
export function decodeNulPaths(input) {
  if (!Buffer.isBuffer(input) || input.length === 0 ||
      input.length > 512_000 || input.at(-1) !== 0) return null;
  const values = input.toString("utf8").split("\0");
  if (values.at(-1) !== "") return null;
  values.pop();
  return values.length && values.every(value => value && !value.includes("\n") &&
    !value.includes("\r") && !value.includes("\\"))
    ? values : null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    if (process.argv.length !== 3) throw Error("expected exactly one NUL paths file");
    const paths = decodeNulPaths(readFileSync(resolve(process.argv[2])));
    process.stdout.write(isOnlyCriticMarkdown(paths) ? "true" : "false");
  } catch {
    // A corrupt/missing path list must run the full suite, never bypass it.
    process.stdout.write("false");
  }
}
