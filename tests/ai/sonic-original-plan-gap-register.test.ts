import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";

interface RecordRow {id:string;classification:string;canonicalEvidence?:string;
  path?:string;originalEndToEndAccepted?:boolean;
  canonicalLiveTriggerVerified?:boolean;canonicalLiveActionVerified?:boolean;
  evidencePr?:number|null;productionVerified?:boolean}
interface Audit{
  schemaVersion:string;canonicalObservedSha:string;frozenBundleHead:string;
  frozenBundleMerged:boolean;featureFreezeRespected:boolean;
  changedScopeApproved:boolean;externalCallsPerformed:boolean;
  databaseMutationsPerformed:boolean;canonicalMergedByAudit:boolean;
  originalAIAgentsEndToEndVerified:number;automationRoadmapUnverifiedTasks:number;
  canonicalFoundations:RecordRow[];agents:RecordRow[];
  shippedWorkflowEvents:string[];shippedWorkflowActions:string[];
  plannedNewEvents:RecordRow[];plannedNewActions:RecordRow[];
  readmeDocs:string[];priorityOrderedGates:number[];
  providerAcceptanceVerified:boolean;stagingAcceptanceVerified:boolean;
  liveProductAccepted:boolean;frozenBundlePr:number;
}
const cwd=process.cwd();
const record:Audit=JSON.parse(readFileSync(
 resolve(cwd,"docs/delivery/sonic-gap/sonic-feature-gap-register-20261025.json"),"utf8")) as Audit;
const uniq=(items:string[])=>new Set(items).size===items.length;
const expectedEvents=["MESSAGE_RECEIVED","QUOTE_SENT","QUOTE_EXPIRED","BOOKING_CONFIRMED",
  "CREW_ASSIGNED","VISIT_DELAYED","INCIDENT_REPORTED","QA_FAILED","INVOICE_ISSUED",
  "INVOICE_OVERDUE","PAYMENT_FAILED","RECURRING_VISIT_DUE"];
const expectedActions=["CREATE_TASK","SET_INTERNAL_PRIORITY","REQUEST_OWNER_APPROVAL",
  "CREATE_DRAFT_REPLY","SUGGEST_SLOT","SCHEDULE_REMINDER","START_N8N_APPROVED_JOB",
  "EMIT_OWNER_DIGEST"];

describe("SONIC original-roadmap read-only feature-gap reconciliation",()=>{
  it("records all 14 original AI agent IDs with real canonical foundation paths",()=>{
    expect(record.schemaVersion).toBe("sonic-gap-v1");
    expect(record.agents.map(x=>x.id)).toEqual(
      Array.from({length:14},(_,i)=>`AI-${String(i+1).padStart(2,"0")}`));
    expect(record.originalAIAgentsEndToEndVerified).toBe(0);
    expect(record.agents.every(x=>x.classification==="PARTIAL_FEATURE" &&
      x.originalEndToEndAccepted===false)).toBe(true);
    for(const a of record.agents){
      expect(a.canonicalEvidence).toMatch(/^src\//);
      expect(existsSync(resolve(cwd,a.canonicalEvidence!))).toBe(true);
    }
    expect(record.canonicalFoundations.length).toBeGreaterThanOrEqual(6);
    expect(uniq(record.canonicalFoundations.map(x=>x.id))).toBe(true);
    for(const built of record.canonicalFoundations){
      expect(built.classification).toBe("BUILT_CANONICAL_COMPONENT");
      expect(built.productionVerified).toBe(false);
      expect(existsSync(resolve(cwd,built.path!))).toBe(true);
    }
  });
  it("distinguishes exactly 5 shipped event/3 shipped action types from planned expanded types",()=>{
    expect(record.shippedWorkflowEvents).toEqual([
      "REQUEST_CREATED","QUOTE_ACCEPTED","VISIT_COMPLETED","INVOICE_PAID","ATTENTION_OPENED"]);
    expect(record.shippedWorkflowActions).toEqual([
      "CREATE_ATTENTION","SEND_EMAIL_TEMPLATE","SEND_WHATSAPP_TEMPLATE"]);
    const contract=readFileSync(resolve(cwd,"src/contracts/workflow-rules.ts"),"utf8");
    for(const name of [...record.shippedWorkflowEvents,...record.shippedWorkflowActions])
      expect(contract).toContain(`"${name}"`);
    const extended=[...expectedEvents,...expectedActions];
    for(const x of extended)expect(contract).not.toContain(`"${x}"`);
  });
  it("records precisely 4 source-only event proposals, 8 event gaps and zero new live triggers",()=>{
    expect(record.plannedNewEvents.map(e=>e.id)).toEqual(expectedEvents);
    expect(uniq(record.plannedNewEvents.map(x=>x.id))).toBe(true);
    expect(record.plannedNewEvents.filter(x=>x.classification==="PROPOSAL_ONLY")
      .map(x=>x.id)).toEqual(["QUOTE_EXPIRED","BOOKING_CONFIRMED","VISIT_DELAYED","INVOICE_OVERDUE"]);
    expect(record.plannedNewEvents.filter(x=>x.classification==="MISSING_WORKFLOW_PRIMITIVE"))
      .toHaveLength(8);
    expect(record.plannedNewEvents.every(x=>!x.canonicalLiveTriggerVerified &&
      (x.classification==="PROPOSAL_ONLY"?x.evidencePr===837:x.evidencePr===null))).toBe(true);
  });
  it("records exactly 4 preview-only action primitives, 4 missing, none in shipped contract",()=>{
    expect(record.plannedNewActions.map(a=>a.id)).toEqual(expectedActions);
    expect(uniq(record.plannedNewActions.map(x=>x.id))).toBe(true);
    expect(record.plannedNewActions.filter(x=>x.classification==="PREVIEW_ONLY")
      .map(x=>x.id)).toEqual([
        "CREATE_TASK","REQUEST_OWNER_APPROVAL","SCHEDULE_REMINDER","EMIT_OWNER_DIGEST"]);
    expect(record.plannedNewActions.filter(x=>x.classification==="MISSING_WORKFLOW_PRIMITIVE"))
      .toHaveLength(4);
    expect(record.plannedNewActions.every(x=>!x.canonicalLiveActionVerified &&
      (x.classification==="PREVIEW_ONLY"?x.evidencePr===837:x.evidencePr===null))).toBe(true);
  });
  it("preserves freeze, operational uncertainty and P02-first release authority",()=>{
    expect(record).toMatchObject({
      featureFreezeRespected:true,changedScopeApproved:false,
      externalCallsPerformed:false,databaseMutationsPerformed:false,
      canonicalMergedByAudit:false,providerAcceptanceVerified:false,
      stagingAcceptanceVerified:false,liveProductAccepted:false,
      frozenBundlePr:841,frozenBundleMerged:false,
      automationRoadmapUnverifiedTasks:72,
    });
    expect(record.canonicalObservedSha).toMatch(/^[a-f0-9]{40}$/);
    expect(record.frozenBundleHead).toMatch(/^[a-f0-9]{40}$/);
    expect(record.priorityOrderedGates[0]).toBe(818);
    expect(record.priorityOrderedGates).toEqual(
      Array.from({length:11},(_,i)=>818+i));
    expect(record.readmeDocs).toHaveLength(4);
    for(const doc of record.readmeDocs){
      expect(doc).toMatch(/^docs\/delivery\/sonic-gap\//);
      expect(existsSync(resolve(cwd,doc))).toBe(true);
    }
  });
});
