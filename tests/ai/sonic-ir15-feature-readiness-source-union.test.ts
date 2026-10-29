import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path));
const manifest = JSON.parse(read("docs/delivery/sonic-ir15-p36-f14-union-source-lock-20261030.json").toString()) as {
 schema: string; baseP36: string; ir14ReviewedPr: number; ir14Head: string;
 sourcePrs: number[]; status: string; exactImportedCount: number;
 sourceObjects: Array<{path:string; blobSha:string;source:string}>;
 reconciledRoute: {path:string;ir14OriginalSha:string;p36OriginalSha:string;
  reviewedIntegratedSha:string;keepP36PricingRouteScope:boolean;
  includeIR14DualScopedWorkflowInspector:boolean;requiresReview:boolean};
 forbiddenEffects: string[]; productionGate: string;
};
const blob = (bytes: Buffer) => createHash("sha1")
 .update(Buffer.from("blob "+bytes.length+"\0")).update(bytes).digest("hex");

describe("IR15 feature integration alongside P36 production-readiness source",()=>{
 it("imports exactly the 78 unchanged IR14 source artifacts and pins each Git object",()=>{
  expect(manifest.schema).toBe("servicedesk.ir15.f08-f14-p36.reviewed-union.v1");
  expect(manifest.ir14ReviewedPr).toBe(865);
  expect(manifest.ir14Head).toBe("5bd1d365c6afd149f3619ffe5317231fd8a7de6f");
  expect(manifest.baseP36).toBe("cb28d52912c4d2b2ad4e8b663b339db3241a3c84");
  expect(manifest.status).toBe("SOURCE_ONLY_DRAFT_UNMERGED");
  expect(manifest.sourcePrs).toEqual([841,852,854,857,859,861]);
  expect(manifest.exactImportedCount).toBe(78);
  expect(manifest.sourceObjects).toHaveLength(78);
  expect(new Set(manifest.sourceObjects.map(row=>row.path)).size).toBe(78);
  for(const row of manifest.sourceObjects){
   expect(row.path).toMatch(/^(src\/|tests\/|docs\/delivery\/)/);
   expect(row.path).not.toContain("..");
   expect(row.path).not.toMatch(/(^|\/)(migrations|supabase|secrets|\.github)\//i);
   expect(row.source).toBe("IR14_PR865_UNCHANGED");
   expect(blob(read(row.path)),row.path).toBe(row.blobSha);
  }
 });
 it("reconciles only the shared route, preserving both human recovery journeys",()=>{
  const route=read("src/features/operations/OperationalProductRoute.tsx").toString();
  const r=manifest.reconciledRoute;
  expect(r.path).toBe("src/features/operations/OperationalProductRoute.tsx");
  expect(r.ir14OriginalSha).toBe("9d801e935d28a2052bd8c57e43dd93788a5a934c");
  expect(r.p36OriginalSha).toBe("ff928ec32e264d53e651c4fe38775f7f7737f5fe");
  expect(r.reviewedIntegratedSha).toBe("189cd79e072789fe121c24a076a0874b41dcca7e");
  expect(blob(read(r.path))).toBe(r.reviewedIntegratedSha);
  expect(r).toMatchObject({requiresReview:true,
   keepP36PricingRouteScope:true,includeIR14DualScopedWorkflowInspector:true});
  expect(route).toMatch(/scope=\{data\.branchScope\}\s+repairTarget=\{book\}/);
  expect((route.match(/<WorkflowExecutionInspector snapshot=\{selectWorkflowInspectorClientSnapshot\(data\)\} workspaceSlug=\{workspaceSlug\} \/>/g)??[])).toHaveLength(2);
  expect(route).not.toContain("<WorkflowExecutionInspector snapshot={data}");
  expect(route).toContain("OwnerAutomationActivationChecklist data={data}");
  expect(route).toContain("reviseCleaningPricingAction");
 });
 it("refuses to classify frozen draft automation and pricing as live operations",()=>{
  expect(manifest.productionGate).toBe("P02_818_NOT_DONE_P03_819_BLOCKED");
  expect(manifest.forbiddenEffects).toContain("CANONICAL_MERGE");
  expect(manifest.forbiddenEffects).toContain("GIT_AUTO_PREVIEW");
  expect(manifest.forbiddenEffects).toContain("PROVIDER_MESSAGE_SEND");
  expect(manifest.forbiddenEffects).toContain("PRODUCTION_DB_MUTATION");
  const v=JSON.parse(read("vercel.json").toString()) as {git?:{deploymentEnabled?:boolean}};
  expect(v.git?.deploymentEnabled).toBe(false);
  const policy=read("src/features/operations/workflow-operator-handoff.ts").toString();
  expect(policy).toContain("canRetryOrApprove: false");
  expect(policy).toContain("providerDeliveryVerified: false");
 });
});
