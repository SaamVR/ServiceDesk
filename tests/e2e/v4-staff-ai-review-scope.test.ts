import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { staffAiReviewScopeKey } from "../../src/features/operations/staff-ai-review-scope";

const base = {
  workspaceSlug: "owner-workspace",
  conversationId: "inbox-1",
  sourceMessageId: "customer-msg-1",
  expectedVersion: 3,
};
const source = readFileSync(join(process.cwd(),
  "src/features/operations/StaffAiReviewComposer.tsx"), "utf8");

describe("V4 human-approved AI reply scope identity", () => {
  it("keeps the same approval session only for the exact saved record version", () => {
    expect(staffAiReviewScopeKey(base)).toBe(staffAiReviewScopeKey({...base}));
    expect(staffAiReviewScopeKey({...base,expectedVersion:4}))
      .not.toBe(staffAiReviewScopeKey(base));
  });
  it("cannot transfer approval across workspaces, conversations or messages", () => {
    for (const update of [
      {workspaceSlug:"foreign-workspace"},
      {conversationId:"inbox-2"},
      {sourceMessageId:"customer-msg-2"},
    ]) {
      expect(staffAiReviewScopeKey({...base,...update}))
        .not.toBe(staffAiReviewScopeKey(base));
    }
  });
  it("is collision resistant for identifier boundaries and separator values", () => {
    expect(staffAiReviewScopeKey({...base,workspaceSlug:"a",conversationId:"b:c"}))
      .not.toBe(staffAiReviewScopeKey({...base,workspaceSlug:"a:b",conversationId:"c"}));
    expect(staffAiReviewScopeKey({...base,sourceMessageId:"x\\0y"}))
      .not.toBe(staffAiReviewScopeKey({...base,sourceMessageId:"x0y"}));
  });
  it("forces a React remount of all review state on the verified scope identity", () => {
    expect(source).toContain('key={staffAiReviewScopeKey(props)}');
    expect(source).toContain('function StaffAiReviewSession(');
    expect(source).toContain("useEffect(() => () => controller.current?.abort(), []);");
    expect(source).toContain("const [draft, setDraft] = useState");
    expect(source).toContain("const [confirmed, setConfirmed] = useState(false)");
    expect(source).toContain("const idempotencyKey = useRef<string | null>(null)");
  });
  it("still requires explicit staff-confirmation and version-bound server approval", () => {
    expect(source).toContain('confirmedByStaff: true');
    expect(source).toContain('expectedVersion,');
    expect(source).toContain('sourceMessageId,');
    expect(source).toContain('idempotencyKey.current = null;');
    expect(source).toContain('receipt || error === "stale"');
    expect(source).toContain('disabled={!canApprove}');
  });
});
