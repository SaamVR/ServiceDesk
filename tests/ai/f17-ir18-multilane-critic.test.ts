import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const read=(p:string)=>readFileSync(p);
const sha=(b:Buffer)=>createHash("sha1").update("blob "+b.length+"\0").update(b).digest("hex");
const lock=JSON.parse(read("docs/delivery/sonic-ir18-f17-saved-operations-source-lock-20261030.json").toString()) as {
 schema:string;parentIR17:string;status:string;
 source:Array<{path:string;sha:string;lane:string}>;
 routes:Array<{path:string;before:string;after:string}>;
 noLiveEffects:string[];productionGate:string;
};
describe("IR18 critic: two real accessible review journeys, no live source mutations",()=>{
 it("pins exact independently authored source and preserved parent",()=>{
  expect(lock.schema).toBe("servicedesk.ir18.f17.saved-operational-journeys.v1");
  expect(lock.parentIR17).toBe("0e5a1bf92b605d8319da83c9769ec52ebc694b65");
  expect(lock.status).toBe("SOURCE_ONLY_DRAFT_UNMERGED");
  expect(lock.source).toHaveLength(7);
  expect(new Set(lock.source.map(x=>x.path)).size).toBe(7);
  expect(new Set(lock.source.map(x=>x.lane)).size).toBe(2);
  for(const row of lock.source){
   expect(row.path).toMatch(/^(src\/features\/operations\/|tests\/ai\/)/);
   expect(row.path).not.toContain("..");
   // Historical IR18 source lock is immutable. Only the exact
   // IR20 selected-quote recovery successor may replace this one source blob.
   if(row.path==="src/features/operations/QuoteRecoveryReadinessPanel.tsx"){
    const successor=JSON.parse(read("docs/delivery/sonic-ir20-f19-owner-recovery-source-lock-20261030.json").toString()) as {
     parentIR19:string;state:string;modified:{quotePanel:{path:string;before:string;after:string}};
    };
    expect(successor.parentIR19).toBe("2f348199f8cd769cdde9c9ded543200f4388b5ef");
    expect(successor.state).toBe("SOURCE_ONLY_DRAFT_UNMERGED");
    expect(successor.modified.quotePanel.path).toBe(row.path);
    expect(successor.modified.quotePanel.before).toBe(row.sha);
    expect(successor.modified.quotePanel.after).toBe("ca9de364d2d66bd8a7024775092e81e71292cde1");
    expect(sha(read(row.path)),row.path).toBe(successor.modified.quotePanel.after);
   }else if(row.path==="tests/ai/f17-quote-recovery-ui.test.ts"){
    const successor=JSON.parse(read("docs/delivery/sonic-ir20-f19-owner-recovery-source-lock-20261030.json").toString()) as {
     modified:{historicalQuoteTest:{path:string;before:string;after:string|null}};
    };
    expect(successor.modified.historicalQuoteTest.path).toBe(row.path);
    expect(successor.modified.historicalQuoteTest.before).toBe(row.sha);
    expect(successor.modified.historicalQuoteTest.after).toBe("3e68b1b1bd3c2feacba997d37d3581aef8e4cb2e");
    expect(sha(read(row.path)),row.path).toBe(successor.modified.historicalQuoteTest.after);
   }else expect(sha(read(row.path)),row.path).toBe(row.sha);
  }
 });
 it("adds quality workflow to existing Jobs, quote triage to existing Quotes",()=>{
  expect(lock.routes).toHaveLength(2);
  for(const row of lock.routes){
   expect(row.before).toMatch(/^[a-f0-9]{40}$/);
   expect(sha(read(row.path)),row.path).toBe(row.after);
  }
  const jobs=read(lock.routes[0].path).toString();
  const quotes=read(lock.routes[1].path).toString();
  expect(jobs).toContain("<JobsSavedQualityPanel workspaceSlug={workspace} selectedJobId={query.job}/>");
  expect(quotes).toContain("<QuoteRecoveryReadinessPanel workspaceSlug={workspace} selectedQuoteId={query.quote}/>");
  expect(jobs).toContain('module="jobs"');
  expect(quotes).toContain('module="quotes"');
 });
 it("uses authorized read-only F02 engine and refuses worker, pricing and provider side effects",()=>{
  const q=read("src/features/operations/f17-visit-quality-action.ts").toString();
  const c=read("src/features/operations/f17-quote-recovery-guide.ts").toString();
  expect(q).toContain("proposeSavedVisitReworkReview(slug,visitId)");
  expect(q).toContain("reworkScheduled:false");
  expect(q).toContain("photoMediaVerified:false");
  expect(c).toContain("AMBIGUOUS_CURRENT_VERSION");
  expect(c).toContain("buildStaffQuoteChecklist(target,loadedAt)");
  expect(c).toContain("customerMessaged:false");
  for(const text of [q,c])for(const forbidden of ["fetch(", ".rpc(", "process.env.", "sendOperationalQuote("])
   expect(text).not.toContain(forbidden);
  expect(lock.productionGate).toBe("P02_818_OPEN_P03_819_QUEUED");
  expect(lock.noLiveEffects).toContain("NO_DEPLOY");
  expect(lock.noLiveEffects).toContain("NO_CANONICAL_MERGE");
 });
});
