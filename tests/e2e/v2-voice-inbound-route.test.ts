import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(join(process.cwd(), "src/app/api/providers/voice/inbound/route.ts"), "utf8");

describe("voice inbound Next route", () => {
  it("uses server configuration and the authoritative missed-call command port", () => {
    expect(route).toContain("readVoiceInboundRuntimeConfig()");
    expect(route).toContain("createPostgresVoiceMissedCallCommandPort");
    expect(route).not.toContain("console.log");
  });

  it("fails closed when configuration is absent and disables response caching", () => {
    expect(route).toContain("Voice inbound is not configured.");
    expect(route).toContain("status: 503");
    expect(route).toContain('"Cache-Control": "no-store"');
  });
});
