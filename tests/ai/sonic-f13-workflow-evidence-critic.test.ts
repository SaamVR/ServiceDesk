import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {buildWorkflowInspector} from "../../src/features/operations/workflow-inspector-model";
import {selectWorkflowInspectorClientSnapshot} from "../../src/features/operations/workflow-inspector-client-snapshot";
import {guideRecordedWorkflowIntervention} from "../../src/features/operations/workflow-operator-guidance";

const read=(path:string)=>readFileSync(path,"utf8");
describe("F13 independent critic: genuine saved workflow evidence and no unsafe commands",()=>{
 it("Automation Studio uses only allowlisted persisted DTO in both recovery states",()=>{
  const s=read("src/features/operations/OperationalProductRoute.tsx");
  const calls=s.match(/<WorkflowExecutionInspector snapshot=\{selectWorkflowInspectorClientSnapshot\(data\)\} workspaceSlug=\{workspaceSlug\} \/>/g)??[];
  expect(calls).toHaveLength(2);
  expect(s).toContain('import { selectWorkflowInspectorClientSnapshot }');
  expect(s).not.toContain('<WorkflowExecutionInspector snapshot={data}');
 });
 it("both authoring and AI Studio use one shared inspector, not a cloned engine",()=>{
  const inspector=read("src/features/operations/WorkflowExecutionInspector.tsx");
  const studio=read("src/features/operations/AiStudioWorkspace.tsx");
  expect(inspector).toContain('id="workflow-evidence"');
  expect(inspector).toContain("guideRecordedWorkflowIntervention(selected)");
  expect(inspector).toContain("buildWorkflowOperatorHandoff(runs, snapshot.workflowAvailable === true, snapshot.loadedAt)");
  expect(inspector).toContain('data-testid="workflow-operator-handoff"');
  expect(inspector).toContain("{operatorHandoff.text}");
  expect(inspector).toContain("This is read-only: retries, approvals, customer messages, payments,");
  expect(studio).toContain('"automations")+"#workflow-evidence"');
  expect(studio).toContain("selectWorkflowInspectorClientSnapshot(data)");
 });
 it("source allowlist excludes customer texts, provider credentials and raw saved actions",()=>{
  const s=read("src/features/operations/workflow-inspector-client-snapshot.ts");
  expect(s).toContain('export function selectWorkflowInspectorClientSnapshot(');
  expect(s).toContain("PUBLIC_WORKFLOW_ERROR_CODES");
  expect(s).not.toContain("process.env.");
 });
 it("fabricated success or cross-branch action cannot authorize a retry or delivery",()=>{
  const ws="11111111-1111-4111-8111-111111111111";
  const a="22222222-2222-4222-8222-222222222222";
  const b="33333333-3333-4333-8333-333333333333";
  const snapshot={loadedAt:"2026-10-26T00:00:00.000Z",workflowAvailable:true,
   workspace:{id:ws,slug:"test-owner",name:"Test",timezone:"UTC"},
   workflowRuleVersions:[{id:"rulev1",ruleId:"rule1",branchId:a,versionNumber:1}],
   workflowExecutions:[{id:"run1",branchId:a,ruleId:"rule1",ruleVersionId:"rulev1",
    mode:"LIVE",eventType:"QUOTE_ACCEPTED",state:"COMPLETED",matched:true,
    createdAt:"2026-10-26T00:00:00.000Z",completedAt:"2026-10-26T00:00:10.000Z"}],
   workflowActionExecutions:[{id:"attk1",branchId:b,executionId:"run1",
    actionIndex:0,attemptNumber:1,actionType:"CREATE_ATTENTION",state:"SUCCEEDED",
    createdAt:"2026-10-26T00:00:01.000Z",completedAt:"2026-10-26T00:00:02.000Z",
    providerSecret:"should-never-cross"}],
  };
  const projected=selectWorkflowInspectorClientSnapshot(snapshot as never);
  expect(JSON.stringify(projected)).not.toContain("should-never-cross");
  const runs=buildWorkflowInspector(projected);
  expect(runs).toHaveLength(1);
  expect(runs[0].actions).toHaveLength(0);
  const verdict=guideRecordedWorkflowIntervention(runs[0]);
  expect(verdict).toMatchObject({providerDeliveryVerified:false,
   automaticRetryAuthorized:false,customerMessageAuthorized:false});
 });
});
