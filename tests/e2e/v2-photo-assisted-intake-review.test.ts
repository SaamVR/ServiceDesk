import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  join(process.cwd(), "src/app/api/request-photos/[assetId]/route.ts"),
  "utf8",
);
const product = readFileSync(
  join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"),
  "utf8",
);

describe("V2 photo-assisted intake staff review", () => {
  it("streams image bytes only after staff authorization and asset eligibility checks", () => {
    expect(route).toContain("resolveStaffActor(workspaceSlug)");
    expect(route).toContain('.from("request_photo_assets")');
    expect(route).toContain('row.state !== "AVAILABLE"');
    expect(route).toContain('row.consent_status !== "GRANTED"');
    expect(route).toContain("row.processing_opt_out === true");
    expect(route).toContain("retainedUntil <= Date.now()");
    expect(route).toContain(".storage");
    expect(route).toContain(".download(storage.objectPath)");
  });

  it("never exposes the opaque storage ref in the product URL or response body", () => {
    expect(product).toContain('"/api/request-photos/" + encodeURIComponent(asset.id)');
    expect(product).not.toContain("storageRef");
    expect(product).not.toContain("storage_ref");
    expect(route).not.toContain("JSON.stringify(row)");
    expect(route).toContain('"cache-control": "private, no-store, max-age=0"');
    expect(route).toContain('"x-content-type-options": "nosniff"');
  });

  it("renders AI confidence, provenance, questions and explicit human review", () => {
    expect(product).toContain("Photo-assisted intake");
    expect(product).toContain("AI suggestion");
    expect(product).toContain("Confidence");
    expect(product).toContain("Classifier");
    expect(product).toContain("Follow-up questions");
    expect(product).toContain("Accept for review");
    expect(product).toContain("Reject suggestion");
  });

  it("states and enforces that review cannot silently change accepted quote truth", () => {
    expect(product).toContain("AI is advisory.");
    expect(product).toContain("Accepted quote is protected");
    expect(product).toContain("create a separate explicit quote revision");
    expect(product).not.toContain("applyPhotoSuggestionToQuote");
    expect(product).not.toContain("updateQuoteFromPhoto");
  });
});
