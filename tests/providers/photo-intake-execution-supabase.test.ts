import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/server/ai/photo-intake-execution-supabase.ts"),
  "utf8",
);

describe("photo classification Supabase execution boundary", () => {
  it("revalidates consent, opt-out, training, retention and request scope before downloading bytes", () => {
    expect(source).toContain('String(asset.request_id) !== input.requestId');
    expect(source).toContain('asset.state !== "AVAILABLE"');
    expect(source).toContain('asset.consent_status !== "GRANTED"');
    expect(source).toContain("asset.processing_opt_out === true");
    expect(source).toContain("asset.training_allowed !== false");
    expect(source).toContain("retentionUntil <= now");
  });

  it("derives classification categories from the active service catalogue and invents no add-on catalogue", () => {
    expect(source).toContain('.from("service_catalog")');
    expect(source).toContain('.eq("active", true)');
    expect(source).toContain("allowedCategoryCodes");
    expect(source).toContain("allowedAddOnCodes: []");
  });

  it("downloads only an opaque private storage ref and revalidates image bytes", () => {
    expect(source).toContain("parseSupabasePhotoStorageRef");
    expect(source).toContain(".download(storage.objectPath)");
    expect(source).toContain("validateRequestPhotoBytes");
    expect(source).toContain("PHOTO_STORAGE_SIZE_MISMATCH");
  });

  it("persists only through the authoritative suggestion RPC", () => {
    expect(source).toContain('"servicedesk_record_request_photo_suggestion"');
    expect(source).not.toContain('.from("requests").update');
    expect(source).not.toContain('.from("quotes").update');
  });
});
