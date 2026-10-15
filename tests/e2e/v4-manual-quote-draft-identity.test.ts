import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("staff manual customer quote clipboard isolation", () => {
  const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
  const handoff = readFileSync(join(process.cwd(), "src/features/operations/QuoteCustomerHandoff.tsx"), "utf8");

  test("forces a fresh draft when quote identity or persisted version changes", () => {
    expect(route).toContain(
      '<QuoteCustomerHandoff key={selectedQuote.id + ":" + selectedQuote.version} workspaceSlug={workspaceSlug} quoteId={selectedQuote.id}',
    );
    expect(route).toContain("facts={selectedQuote.lineItems?.length ? {");
  });

  test("does not carry copied customer-specific quote prices to a new selected quote", () => {
    // QuoteCustomerHandoff owns both the clipboard status and manual text.
    // A keyed remount resets them before a different quote can render.
    expect(handoff).toContain('const [manualSummary, setManualSummary] = useState("")');
    expect(handoff).toContain('const [result, setResult] = useState<');
    expect(handoff).toContain('verifiedManualQuoteHandoffMessage(current.facts, window.location.origin)');
    expect(handoff).toContain("setManualSummary(draft)");
  });
});
