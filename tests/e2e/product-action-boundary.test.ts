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
      ["src/features/checkout/CheckoutPreview.tsx", "hosted checkout command"],
      ["src/features/crew/CrewJobPreview.tsx", "visit transition command"],
      ["src/features/quality/QualityReviewPreview.tsx", "review request command"],
      ["src/features/recovery/RecoveryActionsPreview.tsx", "recovery command"],
      ["src/features/operations/OperationalRoute.tsx", "create/update request command"],
      ["src/features/inbox/InboxPreview.tsx", "thread selection command"],
    ] as const;

    for (const [path, reason] of files) {
      const file = source(path);
      expect(file, path).toContain("disabled");
      expect(file, path).toContain("aria-disabled=\"true\"");
      expect(file, path).toContain(reason);
    }
  });

  it("does not allow provider-verified claims in product fixtures", () => {
    const files = [
      "src/features/request-intake/RequestSummaryPreview.tsx",
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
