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
const successorPath="docs/delivery/sonic-ir21-f15-f20-ui-lifecycle-successor-lock-20261106.json";
const successorRaw=read(successorPath);
const successor=JSON.parse(successorRaw.toString()) as {
 schema:string;historicManifestsUnchanged:string[];
 overrides:Array<{path:string;historicSha:string;currentSha:string;gate:string}>;
 additionalReviewedSource:Array<{path:string;historicSha:string|null;currentSha:string;gate:string}>;
};
function expectedReviewedBlob(path:string,historicSha:string):string {
 const entry=[...successor.overrides,...successor.additionalReviewedSource].find(item=>item.path===path);
 if(!entry)return historicSha;
 expect(entry.historicSha,path+" must preserve the original source lock").toBe(historicSha);
 return entry.currentSha;
}
describe("IR21 exact owner finance + retention source integration",()=>{
 it("pins seven independent finance, retention and critic Git objects",()=>{
  expect(lock.schema).toBe("servicedesk.ir21.f20.owner-verified-finance-retention.v1");
  expect(lock.parentIR20).toBe("4fbc62a16feeb1c08a8dfe7ac0a493ad9b722dfe");
  expect(lock.state).toBe("SOURCE_ONLY_DRAFT_UNMERGED");
  expect(lock.source).toHaveLength(7);
  expect(new Set(lock.source.map(x=>x.path)).size).toBe(7);
  expect(new Set(lock.source.map(x=>x.lane)).size).toBe(3);
  expect(hash(successorRaw)).toBe("08d4e07b7ee3aff7f9f0b7cce7e6d7b24b793442");
  expect(successor.schema).toBe("servicedesk.sonic.ir21.f15-f20.ui-lifecycle-successor.v1");
  expect(successor.historicManifestsUnchanged).toContain(
    "docs/delivery/sonic-ir21-f20-finance-retention-source-lock-20261030.json");
  expect(successor.overrides).toHaveLength(3);
  expect(successor.additionalReviewedSource).toHaveLength(4);
  for(const x of successor.additionalReviewedSource){
   expect(hash(read(x.path)),x.path).toBe(x.currentSha);
  }
  expect(successor.overrides.filter(x=>x.path.startsWith("src/features/operations/Owner")))
    .toHaveLength(3);
  for(const f of lock.source){
   expect(f.path).not.toContain("..");
   expect(hash(read(f.path)),f.path).toBe(expectedReviewedBlob(f.path,f.sha));
  }
  for(const path of ["src/features/operations/OwnerLedgerExceptionReview.tsx",
    "src/features/operations/OwnerConsentedRetentionReview.tsx"]){
   const entry=successor.overrides.find(item=>item.path===path);
   expect(entry).toBeDefined();
   expect(entry?.gate).toContain("F20_");
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
