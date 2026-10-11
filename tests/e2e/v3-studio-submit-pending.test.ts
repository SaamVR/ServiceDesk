import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { StaffSubmitButton } from "../../src/components/product/StaffSubmitButton";

describe("Studio OS server-action submission reliability", () => {
  it("preserves native name/value, initial disabled and submit semantics", () => {
    const html = renderToStaticMarkup(createElement("form", { action: "/offline-test" },
      createElement(StaffSubmitButton, {
        name: "decision", value: "ACCEPTED", className: "app-button-primary",
        disabled: false, pendingLabel: "Approving…",
      }, "Approve now")));
    expect(html).toContain('type="submit"');
    expect(html).toContain('name="decision"');
    expect(html).toContain('value="ACCEPTED"');
    expect(html).toContain('class="app-button-primary"');
    expect(html).toContain("Approve now");
    expect(html).toContain('aria-live="polite"');
  });

  it("never enables a permission-disabled action and exposes an actual busy guard", () => {
    const html = renderToStaticMarkup(createElement("form", null,
      createElement(StaffSubmitButton, { disabled: true }, "Not authorized")));
    expect(html).toContain("disabled");
    const component = readFileSync(join(process.cwd(),
      "src/components/product/StaffSubmitButton.tsx"), "utf8");
    expect(component).toContain('disabled={Boolean(disabled || pending)}');
    expect(component).toContain('aria-busy={pending || undefined}');
    expect(component).toContain("useFormStatus()");
  });

  it("wires all 32 operational command submits to pending protections", () => {
    const source = readFileSync(join(process.cwd(),
      "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    expect(source.match(/<StaffSubmitButton\b/g)).toHaveLength(32);
    expect(source).not.toContain('<button className="app-button-primary" type="submit"');
    for (const label of ["Recording payment…","Queueing reply…","Sending quote…",
      "Assigning crew…","Submitting approval…","Updating checklist…"]) {
      expect(source).toContain('pendingLabel="' + label + '"');
    }
    expect(source).toContain('name="decision"');
    expect(source).toContain('name="status"');
  });
});
