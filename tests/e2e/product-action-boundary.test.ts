import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("product fixture action boundaries", () => {
  it("keeps command-looking fixture actions disabled and labelled", () => {
    const files = [
      ["src/features/request-intake/RequestSummaryPreview.tsx", "ServiceDeskFacade.updateRequest"],
      ["src/features/request-intake/EnquiryForm.tsx", "create/update request command"],
      ["src/features/checkout/CheckoutPreview.tsx", "hosted checkout command"],
      ["src/features/crew/CrewJobPreview.tsx", "visit transition command"],
      ["src/features/quality/QualityReviewPreview.tsx", "Accepted server action is available"],
      ["src/features/recovery/RecoveryActionsPreview.tsx", "recovery command"],
      ["src/features/inbox/InboxPreview.tsx", "thread selection command"],
    ] as const;

    for (const [path, reason] of files) {
      const file = source(path);
      expect(file, path).toContain("disabled");
      if (path === "src/features/quality/QualityReviewPreview.tsx") {
        expect(file, path).toContain("aria-disabled={!enabled}");
      } else {
        expect(file, path).toContain("aria-disabled=\"true\"");
      }
      expect(file, path).toContain(reason);
    }
  });

  it("keeps production-capable request intake components free of fixture imports", () => {
    const productionFiles = [
      "src/features/request-intake/RequestSummaryPreview.tsx",
      "src/features/request-intake/EnquiryForm.tsx",
    ];

    for (const path of productionFiles) {
      expect(source(path), path).not.toContain("sample-data");
    }

    expect(source("src/features/request-intake/RequestSummaryFixturePreview.tsx")).toContain("sample-data");
  });

  it("does not allow provider-verified claims in product fixtures", () => {
    const files = [
      "src/features/request-intake/RequestSummaryPreview.tsx",
      "src/features/request-intake/RequestSummaryFixturePreview.tsx",
      "src/features/request-intake/EnquiryForm.tsx",
      "src/features/checkout/CheckoutPreview.tsx",
      "src/features/crew/CrewJobPreview.tsx",
      "src/features/inbox/InboxPreview.tsx",
      "src/features/quality/QualityReviewPreview.tsx",
      "src/features/recovery/RecoveryActionsPreview.tsx",
      "src/features/operations/OperationalRoute.tsx",
    ];

    for (const path of files) {
      const file = source(path);
      expect(file, path).not.toContain("PROVIDER_VERIFIED");
      expect(file, path).not.toContain("provider verified");
    }
  });
});
