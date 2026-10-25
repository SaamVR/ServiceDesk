import { describe,expect,it } from "vitest";
import {proposeSonicF09Event,SONIC_F09_EVENT_TYPES} from "../../src/server/ai/sonic-f09-event-families";

const now="2026-10-26T02:00:00+06:00";
const past="2026-10-25T09:00:00+06:00";
const root={workspaceId:"tenant_a",branchId:"branch_a",sourceId:"record_01",sourceVersion:3};
const records=[
 {kind:"MESSAGE_RECEIVED",status:"RECEIVED",channel:"EMAIL",receivedAt:past,messageId:"msg_01"},
 {kind:"QUOTE_SENT",status:"SENT",sentAt:past,outboxId:"outbox_01"},
 {kind:"CREW_ASSIGNED",status:"ASSIGNED",assignedAt:past,crewId:"crew_01"},
 {kind:"INCIDENT_REPORTED",status:"OPEN",reportedAt:past,severity:"HIGH"},
 {kind:"QA_FAILED",status:"FAILED",reviewedAt:past,reviewerId:"owner_01"},
 {kind:"INVOICE_ISSUED",status:"ISSUED",issuedAt:past,totalMinor:1200},
 {kind:"PAYMENT_FAILED",status:"FAILED",failedAt:past,providerReceiptId:"provider_01"},
 {kind:"RECURRING_VISIT_DUE",status:"ACTIVE",nextDueAt:past,recurrenceId:"recurrence_01"},
] as const;
const make=(record:Record<string,unknown>,over:Record<string,unknown>={})=>({
 actor:{workspaceId:"tenant_a",role:"OWNER"},
 workspaceId:"tenant_a",branchId:"branch_a",asOf:now,expectedVersion:3,
 record:{...root,...record},...over,
});
describe("SONIC F09 eight additional typed event candidate families",()=>{
 it("covers exactly the eight SONIC roadmap events not present in F06",()=>{
  expect(records.map(x=>x.kind)).toEqual(SONIC_F09_EVENT_TYPES);
 });
 it.each(records)("validates strict saved-projection shape but never emits $kind",record=>{
  const result=proposeSonicF09Event(make(record));
  expect(result.ok).toBe(true);
  if(!result.ok)return;
  expect(result.value).toMatchObject({
   state:"UNPERSISTED_F09_EVENT_CANDIDATE",kind:record.kind,
   workspaceId:"tenant_a",branchId:"branch_a",sourceId:"record_01",sourceVersion:3,
   sourceAuthenticated:false,publisherAuthorized:false,ownerApprovalRequired:true,
   emitted:false,executed:false,scheduled:false,providerCalled:false,
   customerMessageSent:false,moneyChanged:false,
  });
  expect(result.value.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(proposeSonicF09Event(make(record))).toEqual(result);
 });
 it("fails closed on foreign actor and cross-tenant source row",()=>{
  expect(proposeSonicF09Event(make(records[0],{
    actor:{workspaceId:"tenant_b",role:"OWNER"}})))
   .toMatchObject({ok:false,code:"F09_OWNER_REQUIRED"});
  expect(proposeSonicF09Event(make(records[0],{
    actor:{workspaceId:"tenant_a",role:"DISPATCHER"}})))
   .toMatchObject({ok:false,code:"F09_OWNER_REQUIRED"});
  expect(proposeSonicF09Event(make({...root,...records[0],workspaceId:"tenant_b"})))
   .toMatchObject({ok:false,code:"F09_SCOPE_MISMATCH"});
 });
 it("rejects stale revisions, invalid dates, future occurrences and inferred delivery",()=>{
  expect(proposeSonicF09Event(make(records[0],{expectedVersion:4})))
   .toMatchObject({ok:false,code:"F09_SOURCE_STALE"});
  expect(proposeSonicF09Event(make({...records[0],receivedAt:"2026-02-30T10:00:00Z"})))
   .toMatchObject({ok:false,code:"F09_EVIDENCE_INVALID"});
  expect(proposeSonicF09Event(make({...records[0],receivedAt:"2026-10-27T03:00:00+06:00"})))
   .toMatchObject({ok:false,code:"F09_NOT_DUE"});
  expect(proposeSonicF09Event(make({...records[1],status:"DELIVERED"})))
   .toMatchObject({ok:false,code:"F09_EVIDENCE_INVALID"});
 });
 it("rejects made-up financial proof and wrong service/channel states",()=>{
  expect(proposeSonicF09Event(make({...records[5],totalMinor:-10})))
   .toMatchObject({ok:false,code:"F09_EVIDENCE_INVALID"});
  expect(proposeSonicF09Event(make({...records[6],providerReceiptId:""})))
   .toMatchObject({ok:false,code:"F09_EVIDENCE_INVALID"});
  expect(proposeSonicF09Event(make({...records[0],channel:"SMS"})))
   .toMatchObject({ok:false,code:"F09_EVIDENCE_INVALID"});
  expect(proposeSonicF09Event(make({...records[7],status:"CANCELLED"})))
   .toMatchObject({ok:false,code:"F09_EVIDENCE_INVALID"});
 });
 it("denies extra fields, accessors, prototype surprises, non-owner publish flags",()=>{
  expect(proposeSonicF09Event(make({...records[0],autoSend:true})))
   .toMatchObject({ok:false,code:"F09_INVALID_INPUT"});
  expect(proposeSonicF09Event({...make(records[0]),publish:true}))
   .toMatchObject({ok:false,code:"F09_INVALID_INPUT"});
  const r=make(records[0]);Object.defineProperty(r,"asOf",{get(){throw Error("side effect");},enumerable:true});
  expect(proposeSonicF09Event(r)).toMatchObject({ok:false,code:"F09_INVALID_INPUT"});
  expect(proposeSonicF09Event(Object.create({actor:{role:"OWNER"}})))
   .toMatchObject({ok:false,code:"F09_INVALID_INPUT"});
 });
 it("fingerprints source changes without claiming an idempotent execution receipt",()=>{
  const a=proposeSonicF09Event(make(records[0]));
  const b=proposeSonicF09Event(make({...records[0],messageId:"msg_changed"}));
  expect(a.ok&&b.ok).toBe(true);
  if(a.ok&&b.ok)expect(a.value.fingerprint).toBe(b.value.fingerprint);
  // The candidate fingerprint deliberately only uses source ID/version/time.
  // A changed message ID MUST therefore be caught at persisted-source recheck.
  const c=proposeSonicF09Event(make({...records[0],receivedAt:"2026-10-25T10:00:00+06:00"}));
  expect(c.ok).toBe(true);
  if(a.ok&&c.ok)expect(c.value.fingerprint).not.toBe(a.value.fingerprint);
 });
});
