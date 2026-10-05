import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 request and quote operational workspaces", () => {
  it("persists selected request state and focuses one request context", () => {
    const page = source("src/app/app/[workspace]/requests/page.tsx");
    const route = source("src/features/operations/OperationalProductRoute.tsx");

    expect(page).toContain("request?: string");
    expect(page).toContain("selectedRequestId={query.request}");
    expect(route).toContain('orderedRequests.find((request) => request.id === selectedRequestId)');
    expect(route).toContain('selected ? styles.salesQueueSelected : ""');
    expect(route).toContain('href={"?request=" + encodeURIComponent(request.id)}');
    expect(route).toContain('"request=" + encodeURIComponent(requestId) + "&"');
  });

  it("persists selected quote state and focuses one quote context", () => {
    const page = source("src/app/app/[workspace]/quotes/page.tsx");
    const route = source("src/features/operations/OperationalProductRoute.tsx");

    expect(page).toContain("quote?: string");
    expect(page).toContain("selectedQuoteId={query.quote}");
    expect(route).toContain('orderedQuotes.find((quote) => quote.id === selectedQuoteId)');
    expect(route).toContain('selected ? styles.salesQueueSelected : ""');
    expect(route).toContain('href={"?quote=" + encodeURIComponent(quote.id)}');
    expect(route).toContain('"quote=" + encodeURIComponent(quoteId) + "&"');
  });
});
