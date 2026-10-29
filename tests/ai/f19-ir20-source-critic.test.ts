import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const read=(p:string)=>readFileSync(p);
const hash=(v:Buffer)=>createHash("sha1").update("blob "+v.length+"\0").update(v).digest("hex");
const lock=JSON.parse(read("docs/delivery/sonic-ir20-f19-owner-recovery-source-lock-20261030.json").toString()) as {
 schema:string;parentIR19:string;state:string;source:Array<{path:string;sha:string;lane:string}>;
 modified:{
  qualityRoute:{path:string;before:string;after:string};
  quotePanel:{path:string;before:string;after:string};
  historicalQuoteTest:{path:string;before:string;after:string};
  historicalCriticTest:{path:string;before:string;after:string};
 };forbidden:string[];releaseGate:string;
};
describe("IR20 independent exact-source critic and human-approval barrier",()=>{
 it("pins 7 source blobs across three non-overlapping lanes",()=>{
  expect(lock.schema).toBe("servicedesk.ir20.f19.authoritative-quality-quote.v1");
  expect(lock.parentIR19).toBe("2f348199f8cd769cdde9c9ded543200f4388b5ef");
  expect(lock.state).toBe("SOURCE_ONLY_DRAFT_UNMERGED");
  expect(lock.source).toHaveLength(7);
  expect(new Set(lock.source.map(x=>x.path)).size).toBe(7);
  expect(new Set(lock.source.map(x=>x.lane)).size).toBe(3);
  for(const row of lock.source){
   expect(row.path).toMatch(/^(src\/features\/operations\/|tests\/ai\/)/);
   expect(row.path).not.toContain("..");
   expect(hash(read(row.path)),row.path).toBe(row.sha);
  }
 });
 it("retains original IR18 frozen sources and only these exact successors",()=>{
  expect(lock.modified.qualityRoute.before).toBe("d7d409c205c3ad7c3ef7e5e7e921ef64dcf49084");
  expect(lock.modified.quotePanel.before).toBe("b09faa61dec077da4ce2a018ed4852b896201a2e");
  expect(lock.modified.historicalQuoteTest.before).toBe("90ec2ea18eb233364ba693d866a6311b0c50f991");
  expect(lock.modified.historicalCriticTest.before).toBe("e33450aab5d54c6c2543b8c781dbef5be881fa1a");
  for(const row of Object.values(lock.modified)){
   expect(row.after).toMatch(/^[a-f0-9]{40}$/);
   expect(hash(read(row.path)),row.path).toBe(row.after);
  }
  expect(lock.source.find(x=>x.path===lock.modified.quotePanel.path)?.sha)
   .toBe(lock.modified.quotePanel.after);
 });
 it("renders selected case from authorized Quality route and keeps quote send separate",()=>{
  const page=read(lock.modified.qualityRoute.path).toString();
  expect(page).toContain('module="quality"');
  expect(page).toContain("<QualityCaseFollowthroughPanel workspaceSlug={workspace} selectedCaseId={query.case}/>");
  const quote=read(lock.modified.quotePanel.path).toString();
  expect(quote).toContain("Open exact current saved quote revision");
  expect(quote).toContain("Open originating saved request");
  expect(quote).not.toContain("sendOperationalQuote(");
  expect(lock.forbidden).toContain("CANONICAL_MERGE");
  expect(lock.forbidden).toContain("AUTO_RESOLVE");
  expect(lock.releaseGate).toBe("P02_818_OPEN_AND_P03_819_QUEUED");
 });
});
