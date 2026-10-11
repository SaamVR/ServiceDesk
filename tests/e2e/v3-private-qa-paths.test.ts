import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = join(process.cwd(), "tests/e2e/v3-capture-workroom.mjs");
const sha = "f".repeat(40);

describe("V3 authenticated screenshot evidence path containment", () => {
  it("refuses an external-looking profile symlink into Git without opening Chromium", () => {
    const dir = mkdtempSync(join(tmpdir(), "sd-v3-qa-profile-"));
    try {
      const profile = join(dir, "profile-link");
      symlinkSync(process.cwd(), profile, "dir");
      const result = spawnSync(process.execPath, [script], {
        timeout: 5_000,
        encoding: "utf8",
        env: {
          ...process.env,
          V3_QA_ISOLATED: "1",
          V3_QA_BASE_URL: "https://isolated-review.example.test/",
          V3_QA_WORKSPACE: "qa-only",
          V3_QA_EXPECTED_SHA: sha,
          V3_QA_PROFILE_DIR: profile,
          V3_QA_CHROMIUM: process.execPath,
          V3_QA_OUTPUT: join(dir, "private-out"),
        },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Private authenticated browser profiles must stay outside Git");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses screenshot output symlinked through a private temp directory into Git", () => {
    const dir = mkdtempSync(join(tmpdir(), "sd-v3-qa-out-"));
    try {
      const profile = join(dir, "profile");
      mkdirSync(profile, { mode: 0o700 });
      const output = join(dir, "evidence-link");
      symlinkSync(process.cwd(), output, "dir");
      const result = spawnSync(process.execPath, [script], {
        timeout: 5_000,
        encoding: "utf8",
        env: {
          ...process.env,
          V3_QA_ISOLATED: "1",
          V3_QA_BASE_URL: "https://isolated-review.example.test/",
          V3_QA_WORKSPACE: "qa-only",
          V3_QA_EXPECTED_SHA: sha,
          V3_QA_PROFILE_DIR: profile,
          V3_QA_CHROMIUM: process.execPath,
          V3_QA_OUTPUT: output,
        },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Private screenshot output cannot point into Git");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
