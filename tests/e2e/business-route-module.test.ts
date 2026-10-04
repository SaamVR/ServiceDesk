import { describe, expect, it } from "vitest";
import {
  buildBusinessModuleHref,
  businessModuleConfig,
  businessNavigation,
} from "../../src/features/operations/business-modules";

describe("business route module map", () => {
  it("keeps public business routes tied to focused modules", () => {
    expect(Object.keys(businessModuleConfig)).toEqual([
      "home",
      "enquire",
      "book",
    ]);
  });

  it("keeps the public navigation in journey order", () => {
    expect(businessNavigation.map((item) => item.module)).toEqual([
      "home",
      "enquire",
      "book",
    ]);
  });

  it("builds stable public business hrefs from the slug", () => {
    expect(buildBusinessModuleHref("brightroom", "home")).toBe("/b/brightroom");
    expect(buildBusinessModuleHref("brightroom", "enquire")).toBe("/b/brightroom/enquire");
    expect(buildBusinessModuleHref("Bright Room", "book")).toBe("/b/Bright%20Room/book");
  });
});
