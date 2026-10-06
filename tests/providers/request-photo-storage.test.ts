import { describe, expect, it } from "vitest";
import { parseSupabasePhotoStorageRef } from "../../src/server/core/request-photo-storage";

describe("request photo storage references", () => {
  it("parses bounded opaque Supabase storage refs", () => {
    expect(parseSupabasePhotoStorageRef("supabase://request-photos/workspace/request/photo.jpg"))
      .toEqual({ bucket: "request-photos", objectPath: "workspace/request/photo.jpg" });
  });

  it("rejects public URLs, traversal and malformed paths", () => {
    for (const value of [
      "https://example.com/photo.jpg",
      "data:image/jpeg;base64,abc",
      "supabase://request-photos/../secret.jpg",
      "supabase://request-photos//photo.jpg",
      "supabase://request-photos/folder\\photo.jpg",
      "supabase:///photo.jpg",
    ]) {
      expect(parseSupabasePhotoStorageRef(value)).toBeUndefined();
    }
  });
});
