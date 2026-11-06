import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const read=(p:string)=>readFileSync(p);
const hash=(x:Buffer)=>createHash("sha1").update("blob "+x.length+"\0").update(x).digest("hex");
const lock=JSON.parse(read("docs/delivery/sonic-ir21-f20-finance-retention-source-lock-20261030.json").toString()) as {
 schema:string;parentIR20:string;state:string;source:Array<{path:string;sha:string;lane:string}>;
 integration:Array<{path:string;before:string|null;after:string}>;
 forbidden:string[];releaseGate:string;
};
const overlayRaw=read("docs/delivery/sonic-f15-f20-post-lock-ui-guard-20261106.json");
const overlay=JSON.parse(overlayRaw.toString()) as {
 schema:string;baseHead:string;
 originalLocks:Array<{path:string;blob:string}>;
 replacements:Array<{path:string;priorBlob:string;newBlob:string}>;
 changedFiles:Array<{path:string;blob:string}>;
};
const p02Raw=read("docs/delivery/sonic-p02-registered-owner-ui-source-successor-20261106.json");
const p02=JSON.parse(p02Raw.toString()) as {
 schema:string; originalF15F20Overlay:{path:string;blob:string;unchanged:boolean};
 workflowSuccessor:{path:string;previousBlob:string;currentBlob:string};
 changedSource:Array<{path:string;blob:string;intent:string}>;
};
const f23=JSON.parse(read("docs/delivery/sonic-f23-atomic-release-transactional-source-lock-20261107.json").toString()) as {
 schema:string;historicP02ManifestBlob:string;
 workflowSuccessor:{path:string;previousBlob:string;currentBlob:string};
 changedSource:Array<{path:string;blob:string}>;
};
const race=JSON.parse(read("docs/delivery/sonic-f23-owner-revocation-race-successor-20261107.json").toString()) as {
 schema:string;
 historicalLock:{path:string;sha:string;unchanged:boolean};
 workflow:{path:string;oldSha:string;newSha:string};
 testScript:string;testScriptSha:string;requiredReceipts:string[];
};
function expectedReviewedBlob(path:string,historicSha:string):string {
 const entry=overlay.replacements.find(item=>item.path===path);
 if(!entry)return historicSha;
 expect(entry.priorBlob,path+" must preserve original source provenance").toBe(historicSha);
 return entry.newBlob;
}
describe("IR21 exact owner finance + retention source integration",()=>{
 it("pins seven independent finance, retention and critic Git objects",()=>{
  expect(lock.schema).toBe("servicedesk.ir21.f20.owner-verified-finance-retention.v1");
  expect(lock.parentIR20).toBe("4fbc62a16feeb1c08a8dfe7ac0a493ad9b722dfe");
  expect(lock.state).toBe("SOURCE_ONLY_DRAFT_UNMERGED");
  expect(lock.source).toHaveLength(7);
  expect(new Set(lock.source.map(x=>x.path)).size).toBe(7);
  expect(new Set(lock.source.map(x=>x.lane)).size).toBe(3);
  expect(hash(overlayRaw)).toBe("73f0dad66c31dc676b83b58ae17cd2f9f611f688");
  expect(overlay.schema).toBe("servicedesk.f15-f20.post-lock-ui-guard.v1");
  expect(overlay.originalLocks).toContainEqual({
   path:"docs/delivery/sonic-ir21-f20-finance-retention-source-lock-20261030.json",
   blob:"0f1a19568e70fd0209a353876f74d79ad4db0952",
  });
  expect(overlay.replacements).toHaveLength(6);
  expect(overlay.changedFiles).toHaveLength(8);
  expect(hash(p02Raw)).toBe("daedeb155f8d11dfb245b3cca709b20205e400d3");
  expect(p02.schema).toBe("servicedesk.p02.registered-owner-ui-source-successor.v1");
  expect(p02.originalF15F20Overlay.blob).toBe(hash(overlayRaw));
  expect(p02.originalF15F20Overlay.unchanged).toBe(true);
  expect(p02.changedSource).toHaveLength(5);
  for(const source of p02.changedSource){
   expect(source.path).not.toContain("..");
   expect(hash(read(source.path)),source.path).toBe(source.blob);
  }
  expect(f23.schema).toBe("servicedesk.f23.atomic-hold-release.transactional-source.v1");
  expect(f23.historicP02ManifestBlob).toBe(hash(p02Raw));
  expect(f23.workflowSuccessor.previousBlob).toBe(p02.workflowSuccessor.currentBlob);
  expect(f23.workflowSuccessor.path).toBe(p02.workflowSuccessor.path);
  expect(f23.changedSource).toHaveLength(9);
  expect(race.schema).toBe("servicedesk.f23.owner-revocation-race-successor.v1");
  expect(race.historicalLock.path).toBe("docs/delivery/sonic-f23-atomic-release-transactional-source-lock-20261107.json");
  expect(race.historicalLock.sha).toBe("15e909b7abcd4e7ee571646d0b8314dfed1c0a60");
  expect(race.historicalLock.unchanged).toBe(true);
  expect(hash(read(race.historicalLock.path))).toBe(race.historicalLock.sha);
  expect(race.workflow.path).toBe(f23.workflowSuccessor.path);
  expect(race.workflow.oldSha).toBe(f23.workflowSuccessor.currentBlob);
  expect(race.workflow.newSha).toBe("85f48bcb08d99531e889ad0936db8268e2e4aedc");
  expect(race.testScript).toBe("scripts/release/v4-f23-pg17-owner-revocation-race.sh");
  expect(race.testScriptSha).toBe("16de03429be8f4474a1f582e78eb749143723f33");
  expect(hash(read(race.testScript))).toBe(race.testScriptSha);
  expect(race.requiredReceipts).toEqual([
   "PG17_F23_OWNER_REVOKE_FIRST_FOR_SHARE_DENIED_NO_WRITE_PASS",
   "PG17_F23_OWNER_RELEASE_FIRST_LOCK_ROLLBACK_AND_POSITIVE_PASS",
  ]);
  const raceScript=read(race.testScript).toString();
  for(const receipt of race.requiredReceipts)expect(raceScript).toContain(receipt);
  const wf=read(race.workflow.path).toString();
  expect(wf).toContain("bash "+race.testScript);
  for(const f of f23.changedSource){
   expect(f.path).not.toContain("..");
   const reviewed=f.path===race.workflow.path?race.workflow.newSha:f.blob;
   expect(hash(read(f.path)),f.path).toBe(reviewed);
  }
  const priorWorkflow=overlay.changedFiles.find(x=>x.path===p02.workflowSuccessor.path);
  expect(priorWorkflow?.blob).toBe(p02.workflowSuccessor.previousBlob);
  for(const file of overlay.changedFiles){
   const reviewedSha=file.path===p02.workflowSuccessor.path
    ? race.workflow.newSha : file.blob;
   expect(hash(read(file.path)),file.path).toBe(reviewedSha);
  }
  for(const f of lock.source){
   expect(f.path).not.toContain("..");
   expect(hash(read(f.path)),f.path).toBe(expectedReviewedBlob(f.path,f.sha));
  }
  for(const path of ["src/features/operations/OwnerLedgerExceptionReview.tsx",
    "src/features/operations/OwnerConsentedRetentionReview.tsx"]){
   const entry=overlay.replacements.find(item=>item.path===path);
   expect(entry).toBeDefined();
   expect(entry?.priorBlob).toMatch(/^[a-f0-9]{40}$/);
   const source=read(path).toString();
   expect(source).toContain("pending.current");
   expect(source).toContain("useCallback");
   expect(source).not.toContain("sendEmail(");
   expect(source).not.toContain("chargeCard(");
  }
 });
 it("confines new on-screen review buttons to signed-in authorized ALL-branch owner",()=>{
  expect(lock.integration).toHaveLength(3);
  for(const f of lock.integration)expect(hash(read(f.path)),f.path).toBe(f.after);
  const gate=read("src/features/operations/F20OwnerSourceReviewGate.tsx").toString();
  expect(gate).toContain('s.value.actor.role!=="OWNER"');
  expect(gate).toContain('s.value.branchScope?.mode!=="ALL"');
  expect(gate).toContain("loadOperationalStaffSnapshot(workspaceSlug)");
  const invoices=read("src/app/app/[workspace]/invoices/page.tsx").toString();
  const customers=read("src/app/app/[workspace]/customers/page.tsx").toString();
  expect(invoices).toContain('surface="invoices"');
  expect(customers).toContain('surface="customers"');
  expect(invoices).toContain('module="invoices"');
  expect(customers).toContain('module="customers"');
 });
 it("retains the no-external-action launch boundary",()=>{
  expect(lock.forbidden).toContain("CANONICAL_MERGE");
  expect(lock.forbidden).toContain("AUTO_OUTREACH");
  expect(lock.forbidden).toContain("PAYMENT_SETTLEMENT");
  expect(lock.forbidden).toContain("PROVIDER_SEND");
  expect(lock.releaseGate).toBe("P02_818_OPEN_AND_P03_819_QUEUED");
 });
});
