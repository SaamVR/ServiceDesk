import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const api = readFileSync(
  join(process.cwd(), "src/app/api/public/request-photos/route.ts"),
  "utf8",
);
const product = readFileSync(
  join(process.cwd(), "src/features/operations/BusinessProductRoute.tsx"),
  "utf8",
);
const uploader = readFileSync(
  join(process.cwd(), "src/features/request-intake/PublicEnquiryPhotoUploader.tsx"),
  "utf8",
);
const nextConfig = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

describe("V2 public enquiry photo intake", () => {
  it("keeps large photo bytes out of Server Actions and posts raw binary to a bounded API route", () => {
    expect(product).not.toContain('name="photo"');
    expect(uploader).toContain("body: file");
    expect(uploader).toContain('"x-servicedesk-photo-processing-consent": "granted"');
    expect(api).toContain("readBoundedRequestPhotoBody(request)");
    expect(nextConfig).not.toContain("bodySizeLimit");
  });

  it("requires same-origin, explicit consent, and the exact visitor request session before storage", () => {
    expect(api).toContain("isSameOriginPhotoUpload(request)");
    expect(api).toContain("x-servicedesk-photo-processing-consent");
    expect(api).toContain('cookieStore.get("servicedesk_visitor_session")');
    expect(api).toContain('.select("id,visitor_session_id")');
    expect(api).toContain('String(requestResult.data.visitor_session_id ?? "") !== visitorSessionId');
  });

  it("limits abuse and validates actual image content before upload", () => {
    expect(api).toContain("(assetCount.count ?? 0) >= 5");
    expect(api).toContain("validateRequestPhotoBytes");
    expect(api).toContain(".upload(objectPath, validated.value.bytes");
  });

  it("registers opaque metadata and rolls storage back if Core registration fails", () => {
    expect(api).toContain('"servicedesk_register_request_photo_asset"');
    expect(api).toContain("storageRef:");
    expect(api).toContain("supabase://");
    expect(api).toContain("trainingAllowed: false");
    expect(api).toContain("await service.storage.from(bucket).remove([objectPath])");
    expect(api).not.toContain("serviceRoleKey:");
  });

  it("shows photo upload only after a successful enquiry and explains advisory AI semantics", () => {
    expect(product).toContain("submittedRequestId && notice");
    expect(product).toContain("<PublicEnquiryPhotoUploader");
    expect(uploader).toContain("not used to train a customer-image model");
    expect(uploader).toContain("advisory and still requires human review");
  });
});
