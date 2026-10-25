import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";

const ROOT="docs/delivery/sonic-gap/";
const paths=[
  ROOT+"72-workflows-lane-a-inbound-dispatch-20261025.json",
  ROOT+"72-workflows-lane-b-field-finance-20261025.json",
  ROOT+"72-workflows-lane-c-ops-ai-20261025.json",
] as const;
const canonical="ac78ff7737c95aa1b29b679d2b8ede57e5dfcae4";
type Status="BUILT_COMPONENT"|"PARTIAL"|"MISSING_AUTOMATION";
interface Task{
  number:number;title:string;status:Status;canonicalEvidence:string[];
  sourceCaveat:string;nextGate:string;
  acceptedOperationalReceipt:false;liveAutonomousExecutionVerified:false;
}
interface Lane{
 schemaVersion:string;lane:string;canonicalHead:string;issue:number;
 sourceTaskNumbers:number[];authority:"AUDIT_ONLY";items:Task[];
}
const load=():Lane[]=>paths.map(path=>
 JSON.parse(readFileSync(resolve(process.cwd(),path),"utf8")) as Lane);
const flatten=()=>load().flatMap(x=>x.items);
const fingerprint=(titles:readonly string[])=>{
 let state=2166136261;
 for(const ch of titles.join("\n"))state=Math.imul(state^ch.charCodeAt(0),16777619)>>>0;
 return state.toString(16).padStart(8,"0");
};
function verify(data:Lane[]):string[]{
 const errors:string[]=[];
 if(data.length!==3)errors.push("lane-count");
 const seen=new Set<number>(),names=new Set<string>();
 for(const group of data){
  if(group.schemaVersion!=="sonic72-lane-v1"||
   group.canonicalHead!==canonical||group.issue!==173||
   group.authority!=="AUDIT_ONLY")errors.push("metadata");
  for(const row of group.items){
   if(!Number.isInteger(row.number)||row.number<1||row.number>72||
      seen.has(row.number))errors.push("task-id");
   seen.add(row.number);
   if(typeof row.title!=="string"||!row.title.trim()||
      names.has(row.title))errors.push("task-title");
   names.add(row.title);
   if(!["BUILT_COMPONENT","PARTIAL","MISSING_AUTOMATION"].includes(row.status))
      errors.push("status");
   if(row.acceptedOperationalReceipt!==false||
      row.liveAutonomousExecutionVerified!==false)errors.push("false-live-proof");
   if(typeof row.sourceCaveat!=="string"||row.sourceCaveat.length<25)
      errors.push("missing-caveat");
   if(!["P03","P04","P05","P06","P07","P08","P09","P10","CHANGE_ORDER"]
      .includes(row.nextGate))errors.push("unapproved-gate");
   if(!Array.isArray(row.canonicalEvidence)||row.canonicalEvidence.length>3)
      errors.push("evidence-shape");
   else {
    if(row.status==="MISSING_AUTOMATION"&&row.canonicalEvidence.length!==0)
      errors.push("unsupported-missing-claim");
    if(row.status!=="MISSING_AUTOMATION"&&row.canonicalEvidence.length===0)
      errors.push("unsupported-built-claim");
    for(const path of row.canonicalEvidence){
     if(!path.startsWith("src/")||!path.endsWith(".ts")&&
       !path.endsWith(".tsx")||!existsSync(resolve(process.cwd(),path)))
       errors.push("missing-canonical-evidence");
    }
   }
  }
 }
 if(seen.size!==72||[...seen].some((n,i)=>n!==i+1))
   errors.push("missing-task");
 return errors;
}
describe("SONIC #173 complete 72-task source-to-automation reconciliation",()=>{
 it("loads the 3 isolated audit lanes with contiguous 1–30, 31–60 and 61–72 ownership",()=>{
  const lanes=load();
  expect(lanes.map(x=>x.sourceTaskNumbers)).toEqual([[1,30],[31,60],[61,72]]);
  expect(lanes.map(x=>x.items.length)).toEqual([30,30,12]);
  expect(lanes.map(x=>x.items[0]?.number)).toEqual([1,31,61]);
  expect(lanes.map(x=>x.items.at(-1)?.number)).toEqual([30,60,72]);
  expect(verify(lanes)).toEqual([]);
 });
 it("pins all 72 original task names, not invented renamed work packages",()=>{
  const records=flatten();
  expect(fingerprint(records.map(x=>x.title))).toBe("a1c05903");
  expect(records[0]?.title).toBe("Webhook enquiry normalization");
  expect(records[71]?.title).toBe("AI QA pattern analysis");
  expect(records.map(x=>x.number)).toEqual(
    Array.from({length:72},(_,i)=>i+1));
 });
 it("separates 23 built components, 36 partial and 13 task-specific automation gaps",()=>{
  const tasks=flatten();
  expect(tasks.filter(x=>x.status==="BUILT_COMPONENT")).toHaveLength(23);
  expect(tasks.filter(x=>x.status==="PARTIAL")).toHaveLength(36);
  expect(tasks.filter(x=>x.status==="MISSING_AUTOMATION")).toHaveLength(13);
  const missing=tasks.filter(x=>x.status==="MISSING_AUTOMATION").map(x=>x.number);
  expect(missing).toEqual([4,5,7,10,18,24,27,31,35,53,54,56,67]);
  expect(tasks.filter(x=>x.nextGate==="CHANGE_ORDER").map(x=>x.number)).toEqual(missing);
 });
 it("does not transform a source module or mere draft recipe into a live workflow",()=>{
  const data=flatten();
  expect(data.every(x=>x.acceptedOperationalReceipt===false&&
    x.liveAutonomousExecutionVerified===false)).toBe(true);
  expect(data.filter(x=>x.status==="BUILT_COMPONENT")
    .every(x=>x.canonicalEvidence.length>0&&
      x.sourceCaveat.length>=25)).toBe(true);
  expect(data.filter(x=>x.status==="MISSING_AUTOMATION")
    .every(x=>x.canonicalEvidence.length===0)).toBe(true);
 });
 it("rejects duplicate workflow numbers and fraudulent live receipts in-memory",()=>{
  const changed=load();
  changed[0].items[0].number=2;
  expect(verify(changed)).toContain("task-id");
  const spoofed=load();
  (spoofed[0].items[0] as Task & {acceptedOperationalReceipt:boolean})
    .acceptedOperationalReceipt=true;
  expect(verify(spoofed)).toContain("false-live-proof");
 });
 it("refuses silent missing-source evidence or status invention",()=>{
  const bad=load();
  bad[2].items[0].canonicalEvidence=["src/does-not-exist.ts"];
  expect(verify(bad)).toContain("missing-canonical-evidence");
  const noProof=load();
  noProof[0].items[8].canonicalEvidence=[];
  expect(verify(noProof)).toContain("unsupported-built-claim");
 });
});
