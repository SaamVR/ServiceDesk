import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inboxThreadPosition } from "@/features/operations/inbox-thread-navigation";

const rows = [{ id: "thread one" }, { id: "thread/two" }, { id: "thread#three" }];
describe("Staff Inbox keyboard/anchor triage continuity", () => {
  it("preserves filtered queue and search in previous/next deep links", () => {
    const position = inboxThreadPosition(rows, "thread/two", "needs-reply", "Sam & sons");
    expect(position).toEqual({
      index: 2,
      total: 3,
      previousHref: "?queue=needs-reply&conversation=thread+one&search=Sam+%26+sons#active-inbox-thread",
      nextHref: "?queue=needs-reply&conversation=thread%23three&search=Sam+%26+sons#active-inbox-thread",
    });
  });
  it("does not wrap at ends or fabricate a link for stale selected IDs", () => {
    expect(inboxThreadPosition(rows, "thread one", "all").previousHref).toBeUndefined();
    expect(inboxThreadPosition(rows, "thread#three", "all").nextHref).toBeUndefined();
    expect(inboxThreadPosition(rows, "deleted", "all")).toEqual({ index: 0, total: 3 });
  });
  it("keeps keyboard shortcuts disabled inside inputs, buttons and text editors", () => {
    const ui = readFileSync(join(process.cwd(), "src/features/operations/InboxThreadNavigator.tsx"), "utf8");
    expect(ui).toContain("target.isContentEditable");
    expect(ui).toContain("input,textarea,select,button,a,summary");
    expect(ui).toContain('event.key === "j"');
    expect(ui).toContain("document.removeEventListener");
    const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    expect(route).toContain("<InboxThreadNavigator");
  });
});
