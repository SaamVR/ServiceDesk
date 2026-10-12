import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { staffAiReviewScopeKey } from
  "../../src/features/operations/staff-ai-review-scope";

const base = {
  workspaceSlug: "owner-one", conversationId: "thread-one",
  sourceMessageId: "message-one", expectedVersion: 3,
};
describe("human reviewed inbox AI identity isolation",()=>{
  it("produces a stable key for an unchanged saved conversation context",()=>{
    expect(staffAiReviewScopeKey(base)).toBe(staffAiReviewScopeKey({...base}));
  });
  it.each([
    { workspaceSlug: "owner-two" },
    { conversationId: "thread-two" },
    { sourceMessageId: "message-two" },
    { expectedVersion: 4 },
  ])("forces a clean component for each changed identity or saved version: %j",change=>{
    expect(staffAiReviewScopeKey({...base,...change}))
      .not.toBe(staffAiReviewScopeKey(base));
  });
  it("avoids string-concatenation collisions when identifiers contain delimiters",()=>{
    const left={...base,workspaceSlug:"owner:one",conversationId:"thread"};
    const right={...base,workspaceSlug:"owner",conversationId:"one:thread"};
    expect(staffAiReviewScopeKey(left)).not.toBe(staffAiReviewScopeKey(right));
  });
  it("binds the entire editable draft and approval retry key to scoped React instance",()=>{
    const source=readFileSync(join(process.cwd(),
      "src/features/operations/StaffAiReviewComposer.tsx"),"utf8");
    expect(source).toContain("key={staffAiReviewScopeKey(props)}");
    expect(source).toContain("function ScopedStaffAiReviewComposer(");
    expect(source.indexOf("function ScopedStaffAiReviewComposer("))
      .toBeLessThan(source.indexOf("const [draft, setDraft]"));
    expect(source).toContain("useEffect(() => () => controller.current?.abort(), [])");
    expect(source).toContain("const idempotencyKey = useRef");
    expect(source).toContain("setConfirmed(false)");
  });
});
