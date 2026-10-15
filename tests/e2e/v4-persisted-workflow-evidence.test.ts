import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeWorkflowEvidence } from "../../src/features/operations/workflow-evidence-summary";
import type {
  OperationalWorkflowExecution, OperationalWorkflowActionExecution,
} from "../../src/features/operations/operational-product-runtime";

const live:OperationalWorkflowExecution={
  id:"live-1",branchId:"branch-a",ruleId:"rule-1",ruleVersionId:"version-1",
  mode:"LIVE",eventType:"REQUEST_CREATED",matched:true,recursionDepth:0,
  state:"ACTIONS_PENDING",createdAt:"2026-10-12T00:00:00Z"
};
const preview:OperationalWorkflowExecution={...live,id:"preview-1",mode:"PREVIEW",state:"PREVIEWED"};
const action=(executionId:string,state:OperationalWorkflowActionExecution["state"],
  actionType:OperationalWorkflowActionExecution["actionType"]):OperationalWorkflowActionExecution=>({
  id:executionId+"-"+state+"-"+actionType,branchId:"branch-a",executionId,actionIndex:0,
  attemptNumber:1,actionType,state,createdAt:"2026-10-12T00:01:00Z",
});

describe("V4 operator proof of persisted workflow activity",()=>{
  it("never claims synthetic previews are successful real automation",()=>{
    const s=summarizeWorkflowEvidence({
      workflowExecutions:[preview],
      workflowActionExecutions:[action("preview-1","SUCCEEDED","CREATE_ATTENTION")]
    });
    expect(s).toMatchObject({
      recordedLiveExecutions:0,matchedLiveExecutions:0,previewExecutions:1,
      internalAttentionSucceeded:0,providerDeliveryVerified:false
    });
  });
  it("counts recorded live executions, queued internal work and unapproved outbound actions",()=>{
    const s=summarizeWorkflowEvidence({
      workflowExecutions:[live,preview],
      workflowActionExecutions:[
        action("live-1","SUCCEEDED","CREATE_ATTENTION"),
        action("live-1","APPROVAL_REQUIRED","SEND_WHATSAPP_TEMPLATE"),
        action("live-1","APPROVED","SEND_EMAIL_TEMPLATE"),
        action("preview-1","FAILED","SEND_WHATSAPP_TEMPLATE")
      ],
    });
    expect(s).toMatchObject({
      recordedLiveExecutions:1,matchedLiveExecutions:1,previewExecutions:1,
      internalAttentionSucceeded:1,externalApprovalRequired:1,
      approvedExternalPending:1,failedActions:0,providerDeliveryVerified:false
    });
  });
  it("tracks failure and pending attention without treating external SUCCESS as provider receipts",()=>{
    const s=summarizeWorkflowEvidence({
      workflowExecutions:[live],
      workflowActionExecutions:[
        action("live-1","FAILED","SEND_EMAIL_TEMPLATE"),
        action("live-1","PENDING","CREATE_ATTENTION"),
        action("live-1","SUCCEEDED","SEND_WHATSAPP_TEMPLATE")
      ]
    });
    expect(s.failedActions).toBe(1);
    expect(s.internalAttentionPending).toBe(1);
    expect(s.internalAttentionSucceeded).toBe(0);
    expect(s.providerDeliveryVerified).toBe(false);
  });
  it("does not inflate successful automation from another branch, unmatched event or corrupt action identity",()=>{
    const valid = action("live-1","SUCCEEDED","CREATE_ATTENTION");
    for(const invalid of [
      { ...valid, branchId:"foreign-branch" },
      { ...valid, actionIndex:-1 },
      { ...valid, attemptNumber:0 },
      { ...valid, attemptNumber:Number.NaN },
      { ...valid, executionId:"missing" },
    ]) {
      const result = summarizeWorkflowEvidence({
        workflowExecutions:[live],
        workflowActionExecutions:[invalid],
      });
      expect(result.internalAttentionSucceeded).toBe(0);
      expect(result.providerDeliveryVerified).toBe(false);
    }
    const unmatched = summarizeWorkflowEvidence({
      workflowExecutions:[{...live,matched:false}],
      workflowActionExecutions:[valid],
    });
    expect(unmatched.recordedLiveExecutions).toBe(1);
    expect(unmatched.matchedLiveExecutions).toBe(0);
    expect(unmatched.internalAttentionSucceeded).toBe(0);
  });
  it("renders the evidence on both empty and nonempty recovery variants, with readable CSS",()=>{
    const path=(x:string)=>readFileSync(join(process.cwd(),x),"utf8");
    const route=path("src/features/operations/OperationalProductRoute.tsx");
    const ui=path("src/features/operations/WorkflowEvidenceStrip.tsx");
    const css=path("src/features/operations/WorkflowEvidenceStrip.module.css");
    expect(route.split("<WorkflowEvidenceStrip executions=").length).toBe(3);
    expect(ui).toContain("Database evidence · not provider delivery");
    expect(ui).toContain("not establish external delivery");
    expect(ui).toContain("draft or simulated preview is not a live event");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(css).toContain("@media (max-width: 410px)");
  });
});
