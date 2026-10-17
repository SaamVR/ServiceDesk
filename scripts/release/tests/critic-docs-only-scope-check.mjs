import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeNulPaths, isOnlyCriticMarkdown } from "../critic-docs-only-scope.mjs";

test("allows strictly isolated critic Markdown documentation PRs", () => {
  for (const paths of [
    ["docs/engineering/critic/2026-10-17-review.md"],
    ["docs/control-tower/critic/r11-review.md"],
    ["docs/engineering/critic/history/feedback_01.md", "docs/control-tower/critic/acceptance/evidence.md"],
  ]) {
    const parsed = decodeNulPaths(Buffer.from(paths.join("\0") + "\0"));
    assert.deepEqual(parsed, paths);
    assert.equal(isOnlyCriticMarkdown(parsed), true);
  }
});

test("never treats source, tests, config, migrations or ordinary docs as critic-only", () => {
  for (const files of [
    [],
    ["src/server/ai/request-brief-safety.ts"],
    ["docs/engineering/critic/r12.md", "src/server/ai/request-brief-safety.ts"],
    ["docs/control-tower/critic/r12.md", "supabase/migrations/0063_recovery.sql"],
    ["docs/engineering/critic/r12.md", ".github/workflows/v4-controller-pr-full-source-rc.yml"],
    ["docs/readme.md"], ["README.md"],
    ["docs/engineering/critic/validator.mjs"],
    ["docs/engineering/critic/.. /r12.md"],
    ["docs/engineering/critic/../r12.md"],
    ["docs/control-tower/critic/r12.mdx"],
    ["docs/control-tower/critic/r12.md", "package.json"],
  ]) assert.equal(isOnlyCriticMarkdown(files), false, files.join(","));
});

test("malformed or empty git NUL stream forces full source validation", () => {
  for (const input of [
    Buffer.from(""), Buffer.from("docs/engineering/critic/r12.md"),
    Buffer.from("\0"), Buffer.from("docs/control-tower/critic/r12.md\n\0"),
    Buffer.from("docs/engineering/critic/r12.md\0src/lib.ts\0"),
  ]) {
    const decoded = decodeNulPaths(input);
    if (decoded && decoded.some(path => path.startsWith("src/"))) {
      assert.equal(isOnlyCriticMarkdown(decoded), false);
    } else {
      assert.equal(decoded, null);
    }
  }
  assert.equal(isOnlyCriticMarkdown(null), false);
  assert.equal(isOnlyCriticMarkdown(undefined), false);
});
