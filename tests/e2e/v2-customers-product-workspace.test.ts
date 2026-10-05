import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V2 customers operational workspace", () => {
  it("persists the selected customer in route state", () => {
    const page = source("src/app/app/[workspace]/customers/page.tsx");
    const route = source("src/features/operations/OperationalProductRoute.tsx");

    expect(page).toContain("customer?: string");
    expect(page).toContain("selectedCustomerId={query.customer}");
    expect(route).toContain('orderedCustomers.find((customer) => customer.id === selectedCustomerId)');
    expect(route).toContain('selected ? styles.crmQueueSelected : ""');
  });

  it("renders one customer context instead of expanding many customer panels", () => {
    const route = source("src/features/operations/OperationalProductRoute.tsx");

    expect(route).toContain('href={"?customer=" + encodeURIComponent(customer.id)}');
    expect(route).toContain("selectedProperties");
    expect(route).toContain("selectedRequests");
    expect(route).not.toContain("data.customers.slice(0, 8).map");
  });
});
