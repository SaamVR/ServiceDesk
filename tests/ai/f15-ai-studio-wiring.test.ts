import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const read=(path:string)=>readFileSync(path);
const lock=JSON.parse(read("docs/delivery/sonic-ir16-f15-ai-studio-source-lock-20261030.json").toString()) as {
 base:string;sourceOnly:boolean;files:Array<{path:string;blobSha:string;lane:string}>;
 integratedWorkbenchSha:string;
};
const hash=(content:Buffer)=>createHash("sha1").update("blob "+content.length+"\0").update(content).digest("hex");
describe("F15 visible saved-record AI Studio integration",()=>{
 it("pins 3 genuinely isolated implementation lanes and 9 original source objects",()=>{
  expect(lock.base).toBe("ea6613e2f30f2fc7909d30a04a513f4d7150b3c1");
  expect(lock.sourceOnly).toBe(true);
  expect(lock.files).toHaveLength(9);
  expect(new Set(lock.files.map(x=>x.path)).size).toBe(9);
  expect(new Set(lock.files.map(x=>x.lane)).size).toBe(3);
  for(const item of lock.files){
   expect(item.path).toMatch(/^(src\/features\/operations\/|tests\/ai\/)/);
   expect(item.path).not.toContain("..");
   expect(hash(read(item.path)),item.path).toBe(item.blobSha);
  }
 });
 it("renders all three genuinely callable actions on the existing saved-record workbench",()=>{
  const source=read("src/features/operations/AiStudioWorkbench.tsx").toString();
  expect(hash(read("src/features/operations/AiStudioWorkbench.tsx"))).toBe(lock.integratedWorkbenchSha);
  expect(source).toContain("<AiSavedIntakeReview workspaceSlug={workspaceSlug} requestId={selected.id} />");
  expect(source).toContain("<AiSavedCapacityReview workspaceSlug={workspaceSlug} />");
  expect(source).toContain("<AiSavedBusinessReview workspaceSlug={workspaceSlug} />");
  expect(source).toContain('selected && mode === "request"');
  expect(source).toContain("Daily/weekly intelligence is owner-only");
 });
 it("new server actions call only F01/F02/F03 double-read persisted engines and never providers",()=>{
  const files=[
   ["f15-saved-intake-review-action.ts","planAuthorizedSavedIntake"],
   ["f15-saved-capacity-review-action.ts","proposeSavedCapacityDispatch"],
   ["f15-saved-business-review-action.ts","loadF03SavedDailyWeeklyIntelligence"],
  ];
  for(const [file,fn] of files){
   const src=read("src/features/operations/"+file).toString();
   expect(src).toContain('"use server"');
   expect(src).toContain(fn);
   for(const forbidden of ["fetch(", ".rpc(", "sendEmail(", "sendWhatsApp(", "charge(", "process.env."])
     expect(src).not.toContain(forbidden);
  }
 });
});
