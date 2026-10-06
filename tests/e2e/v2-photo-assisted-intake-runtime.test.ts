import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const runtime = readFileSync(
  join(process.cwd(), "src/features/operations/operational-product-runtime.ts"),
  "utf8",
);

describe("V2 photo-assisted intake operational runtime", () => {
  it("loads photo review data separately so missing V2 tables do not break existing request workflows", () => {
    expect(runtime).toContain("photoReviewAvailable = !photoAssetRead.error && !photoSuggestionRead.error");
    expect(runtime).toContain("photoReviewAvailable ? rows(photoAssetRead.data) : []");
    expect(runtime).toContain("photoReviewAvailable ? rows(photoSuggestionRead.data) : []");
  });

  it("uses only the authoritative review RPC for accept/reject", () => {
    expect(runtime).toContain('"servicedesk_review_request_photo_suggestion"');
    expect(runtime).toContain("expectedVersion");
    expect(runtime).toContain("quoteRevisionRequired");
    expect(runtime).not.toContain(".from(\"quotes\").update");
    expect(runtime).not.toContain(".from(\"requests\").update");
  });

  it("preserves the accepted-quote revision warning returned by Core", () => {
    expect(runtime).toContain("The accepted quote is unchanged; create an explicit quote revision before any price change.");
  });
});
