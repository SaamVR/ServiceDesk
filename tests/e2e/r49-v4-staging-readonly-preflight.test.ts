import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { join } from "node:path";

describe("R49 V4 read-only staging release guard", () => {
  it("executes the Node-native safety suite in normal full Vitest RC", () => {
    const output = execFileSync(
      process.execPath,
      ["--test", join(process.cwd(), "scripts/release/v4-staging-readonly-preflight.test.mjs")],
      { cwd: process.cwd(), encoding: "utf8", timeout: 15_000, env: { NODE_ENV: "test" } },
    );
    expect(output).toContain("# pass 5");
    expect(output).toContain("# fail 0");
  });
  it("keeps default invocation non-authorized and refuses any implicit target", () => {
    try {
      execFileSync(
        process.execPath,
        [join(process.cwd(), "scripts/release/v4-staging-readonly-preflight.mjs")],
        { cwd: process.cwd(), encoding: "utf8", timeout: 5_000, env: { NODE_ENV: "test" }, stdio: "pipe" },
      );
      throw new Error("Missing operator permission must be blocked");
    } catch (error) {
      const result = error as { status?: number; stderr?: Buffer };
      expect(result.status).toBe(2);
      expect(result.stderr?.toString("utf8")).toContain("READONLY_PREFLIGHT_BLOCKED");
    }
  });
});
