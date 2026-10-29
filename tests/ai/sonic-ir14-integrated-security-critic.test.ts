import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
const text=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");
const lock=JSON.parse(text("docs/delivery/sonic-ir14-exact-source-lock-20261026.json")) as {
 files:Array<{path:string;status:string;sourcePr:number}>;sourceHeads:Record<string,string>;
};
describe("IR14 independent source critic — reviewer authority stays with Production",()=>{
 it("does not smuggle an alternate F01–F07 bundle or overlap a source file",()=>{
  const paths=lock.files.map(x=>x.path);
  expect(new Set(paths).size).toBe(paths.length);
  // Only F08 combined bundle is rehearsed; do NOT add legacy F01-F07
  // per-feature PRs on top of #841 or count those as separate merge choices.
  expect(Object.keys(lock.sourceHeads).sort())
   .toEqual(["841","852","854","857","859","861"]);
  expect(lock.files.filter(x=>x.sourcePr===841)).toHaveLength(33);
 });
 it("preserves source-only, owner-only, real active workspace branch guard",()=>{
  const scope=text("src/features/operations/owner-opportunity-preview-action.ts");
  expect(scope).toContain('from("workspace_branches")');
  expect(scope).toContain('.eq("active",true)');
  expect(scope).toContain('published:false');
  expect(scope).toContain('providerMessagesSent:false');
  expect(scope).toContain('financialStateChanged:false');
  expect(scope).not.toContain("OPENAI_API_KEY");
 });
 it("does not silently activate a customer contact or financial mutation",()=>{
  const scope=text("src/features/operations/OwnerOpportunityWorkbench.tsx");
  expect(scope).toContain("workspace-wide");
  expect(scope).toContain("not necessarily the selected branch");
  expect(scope).toContain("No paid model calls");
  const guidance=text("src/features/operations/workflow-operator-guidance.ts");
  for(const key of ["automaticRetryAuthorized:false",
   "automaticApprovalAuthorized:false","financialMutationAuthorized:false",
   "customerMessageAuthorized:false","rulePublicationAuthorized:false",
   "providerDeliveryVerified:false"]){
   expect(guidance).toContain(key);
  }
 });
 it("retains owner-command isolation and authorized browser-safe saved evidence",()=>{
  const r=text("src/features/operations/OperationalProductRoute.tsx");
  expect(r.match(/<WorkflowExecutionInspector snapshot=\{selectWorkflowInspectorClientSnapshot\(data\)\} workspaceSlug=\{workspaceSlug\} \/>/g))
   .toHaveLength(2);
  expect(r).not.toContain('<WorkflowExecutionInspector snapshot={data}');
  const client=text("src/features/operations/workflow-inspector-client-snapshot.ts");
  expect(client).toContain("PUBLIC_WORKFLOW_ERROR_CODES");
 });
 it("includes F14 read-only owner handoff and anomaly source evidence",()=>{
  const ui=text("src/features/operations/WorkflowExecutionInspector.tsx");
  const helper=text("src/features/operations/workflow-operator-handoff.ts");
  const model=text("src/features/operations/workflow-inspector-model.ts");
  expect(ui).toContain('data-testid="workflow-operator-handoff"');
  expect(ui).toContain("buildWorkflowOperatorHandoff(runs, snapshot.workflowAvailable === true, snapshot.loadedAt)");
  expect(helper).toContain("providerDeliveryVerified: false");
  expect(helper).toContain("canRetryOrApprove: false");
  expect(helper).toContain("Object.hasOwn(eventLabels, entry.run.eventType)");
  expect(model).toContain('run.state === "PREVIEWED") return "ambiguous"');
  expect(lock.files.filter(x=>x.sourcePr===861)).toHaveLength(11);
  expect(lock.files.some(x=>x.path==="tests/ai/sonic-f14-workflow-owner-handoff.test.ts")).toBe(true);
 });
 it("preserves explicit deployment veto",()=>{
  const v=JSON.parse(text("vercel.json")) as {git?:{deploymentEnabled?:boolean}};
  expect(v.git?.deploymentEnabled).toBe(false);
  expect(lock.files.some(f=>f.path==="vercel.json"||f.path.startsWith(".github/"))).toBe(false);
 });
 it("source acceptance is not an active workflow or end-to-end commercial receipt",()=>{
  const d=text("docs/delivery/sonic-ir14-production-merge-decision-20261026.md");
  expect(d).toContain("DRAFT / UNMERGED");
  expect(d).toContain("P02");
  expect(d).toContain("NO LIVE AUTOMATION CREDIT");
  expect(d).toContain("F08");
 });
});
