import { describe, expect, it } from "vitest";
import {
  isSameOriginPhotoUpload,
  readBoundedRequestPhotoBody,
  requestPhotoObjectPath,
  requestPhotoRetentionDays,
  validateRequestPhotoBytes,
} from "../../src/server/core/request-photo-upload";

describe("public request photo upload guards", () => {
  it("validates declared type against image magic bytes", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(validateRequestPhotoBytes({ declaredType: "image/jpeg", bytes: jpeg }))
      .toMatchObject({ ok: true, value: { mediaType: "image/jpeg", extension: "jpg" } });
    expect(validateRequestPhotoBytes({ declaredType: "image/png", bytes: jpeg }))
      .toMatchObject({ ok: false, code: "REQUEST_PHOTO_TYPE_INVALID" });
  });

  it("rejects oversized declared and streamed bodies before unbounded buffering", async () => {
    const declared = new Request("https://service.test/upload", {
      method: "POST",
      headers: { "content-length": "99" },
      body: new Uint8Array([1, 2, 3]),
    });
    expect(await readBoundedRequestPhotoBody(declared, 16))
      .toMatchObject({ ok: false, code: "REQUEST_PHOTO_SIZE_INVALID" });

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(10));
        controller.enqueue(new Uint8Array(10));
        controller.close();
      },
    });
    const chunked = new Request("https://service.test/upload", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    expect(await readBoundedRequestPhotoBody(chunked, 16))
      .toMatchObject({ ok: false, code: "REQUEST_PHOTO_SIZE_INVALID" });
  });

  it("requires exact same-origin uploads", () => {
    expect(isSameOriginPhotoUpload(new Request("https://service.test/api", {
      method: "POST",
      headers: { origin: "https://service.test" },
    }))).toBe(true);
    expect(isSameOriginPhotoUpload(new Request("https://service.test/api", {
      method: "POST",
      headers: { origin: "https://evil.test" },
    }))).toBe(false);
  });

  it("builds request-scoped opaque object paths and bounds retention config", () => {
    expect(requestPhotoObjectPath({
      workspaceId: "11111111-1111-1111-1111-111111111111",
      requestId: "22222222-2222-2222-2222-222222222222",
      assetToken: "33333333-3333-3333-3333-333333333333",
      extension: "webp",
    })).toBe("11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/33333333-3333-3333-3333-333333333333.webp");
    expect(requestPhotoRetentionDays(undefined)).toBe(30);
    expect(requestPhotoRetentionDays("7")).toBe(7);
    expect(requestPhotoRetentionDays("365")).toBe(30);
  });
});
