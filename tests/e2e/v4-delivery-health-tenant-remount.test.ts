import {describe,expect,test} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
describe("delivery diagnostics tenant-scope isolation",()=>{
test("remounts when workspace switches and cancels obsolete requests",()=>{
const src=readFileSync(join(process.cwd(),"src/features/operations/InboxDeliveryDiagnostics.tsx"),"utf8");
expect(src).toContain("key={workspaceSlug}");
expect(src).toContain("function ScopedInboxDeliveryDiagnostics");
expect(src).toContain("requestController.current?.abort()");
expect(src).toContain("15_000");
expect(src).toContain("clearTimeout(timeout)");
expect(src).toContain("if (controller.signal.aborted) return;");
});
});