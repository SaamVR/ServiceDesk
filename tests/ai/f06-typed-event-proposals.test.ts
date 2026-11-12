import {describe,expect,it} from "vitest";
import {proposeF06TypedEvent} from "../../src/server/ai/f06-typed-event-proposals";
const ws="workspace-1",branch="branch-1",at="2026-10-25T06:00:00.000Z";
const actor={workspaceId:ws,role:"OWNER"};
const base={workspaceId:ws,branchId:branch,sourceId:"source-1",sourceVersion:3};
const sources=[
 {...base,eventType:"QUOTE_EXPIRED",status:"SENT",validUntil:"2026-10-24T06:00:00.000Z"},
 {...base,eventType:"BOOKING_CONFIRMED",status:"CONFIRMED",
  confirmedAt:"2026-10-20T06:00:00.000Z",scheduledStartAt:"2026-10-27T06:00:00.000Z"},
 {...base,eventType:"VISIT_DELAYED",status:"EN_ROUTE",delayState:"PERSISTED_DELAY_RECORDED",
  scheduledStartAt:"2026-10-25T04:00:00.000Z",delayRecordedAt:"2026-10-25T05:00:00.000Z",
  recordedDelayMinutes:45},
 {...base,eventType:"INVOICE_OVERDUE",status:"PARTIALLY_PAID",
  dueAt:"2026-10-24T06:00:00.000Z",totalMinor:12000,balanceMinor:4000},
];
const input=(record:unknown)=>({actor,workspaceId:ws,branchId:branch,
 observedAt:at,expectedSourceVersion:3,record});
describe("F06 pure proposed events for four future workflow categories",()=>{
 it("classifies all four bounded saved projections without writing, emitting, or inventing provider receipts",()=>{
  for(const record of sources){
   const r=proposeF06TypedEvent(input(record));
   expect(r).toMatchObject({ok:true,value:{
    state:"F06_UNPERSISTED_EVENT_CANDIDATE_ONLY",
    eventType:record.eventType,workspaceId:ws,branchId:branch,
    sourceId:"source-1",sourceVersion:3,observedAt:at,
    sourceEvidence:"CALLER_SUPPLIED_SAVED_PROJECTION_UNVERIFIED",
    eventProposalFingerprint:expect.stringMatching(/^[a-f0-9]{64}$/),
    persistedSourceMustBeReauthenticated:true,
    sourceVersionMustBeRechecked:true,branchAuthorityUnverified:true,
    ownerApprovalRequired:true,emitted:false,executed:false,published:false,
    providerCalled:false,customerMessageSent:false,moneyChanged:false,
   }});
   expect(JSON.stringify(r)).not.toContain("PRIVATE CONTACT");
  }
 });
 it("uses stable tenant/source/version evidence fingerprints, not runtime-driven fake event IDs",()=>{
  const a=proposeF06TypedEvent(input(sources[0]));
  const b=proposeF06TypedEvent(input({...sources[0]}));
  expect(a).toEqual(b);
  const changed=proposeF06TypedEvent({...input({...sources[0],sourceVersion:4}),
    expectedSourceVersion:4});
  expect(changed).toMatchObject({ok:true});
  if(a.ok&&changed.ok)
    expect(a.value.eventProposalFingerprint).not.toBe(changed.value.eventProposalFingerprint);
 });
 it("requires owner-only matching workspace and exact branch record identity",()=>{
  for(const value of [
   {...input(sources[0]),actor:{...actor,role:"DISPATCHER"}},
   {...input(sources[0]),actor:{workspaceId:"foreign",role:"OWNER"}},
  ])expect(proposeF06TypedEvent(value)).toMatchObject({
   ok:false,code:"F06_EVENT_OWNER_REQUIRED",
  });
  for(const value of [
   {...input({...sources[0],workspaceId:"foreign"})},
   {...input({...sources[0],branchId:"foreign"})},
  ])expect(proposeF06TypedEvent(value)).toMatchObject({
   ok:false,code:"F06_EVENT_TENANT_MISMATCH",
  });
  expect(proposeF06TypedEvent({...input(sources[0]),expectedSourceVersion:2}))
   .toMatchObject({ok:false,code:"F06_EVENT_VERSION_STALE"});
 });
 it("never infers quote expiry or overdue invoice from unpassed deadlines and unverified money",()=>{
  const failSources=[
   {...sources[0],status:"ACCEPTED"},
   {...sources[0],validUntil:"2026-10-27T06:00:00.000Z"},
   {...sources[0],validUntil:"2026-02-30T06:00:00.000Z"},
   {...sources[3],status:"PAID"},
   {...sources[3],balanceMinor:0},
   {...sources[3],balanceMinor:20000},
   {...sources[3],totalMinor:NaN},
   {...sources[3],dueAt:"2026-10-28T06:00:00.000Z"},
  ];
  for(const record of failSources)
    expect((proposeF06TypedEvent(input(record))).ok).toBe(false);
 });
 it("requires explicit saved confirmation and recorded delay instead of an estimated arrival",()=>{
  const failSources=[
   {...sources[1],status:"PENDING"},
   {...sources[1],confirmedAt:"2026-10-28T06:00:00.000Z"},
   {...sources[1],scheduledStartAt:"2026-10-19T06:00:00.000Z"},
   {...sources[2],status:"CANCELLED"},
   {...sources[2],delayState:"MODEL_PREDICTED"},
   {...sources[2],recordedDelayMinutes:0},
   {...sources[2],recordedDelayMinutes:99999},
   {...sources[2],delayRecordedAt:"2026-10-25T03:00:00.000Z"},
   {...sources[2],delayRecordedAt:"2026-10-26T06:00:00.000Z"},
  ];
  for(const record of failSources)
    expect((proposeF06TypedEvent(input(record))).ok).toBe(false);
 });
 it("rejects hidden action permissions, unknown keys, accessors, symbols and unsafe payloads",()=>{
  const hidden=Object.defineProperty({...sources[0]},"sendCustomerEmail",{
   enumerable:false,value:true,
  });
  const accessor=Object.defineProperty({...sources[1]},"secretAction",{
   enumerable:true,get:()=>{throw Error("should not evaluate");},
  });
  const symbol={...sources[2],[Symbol("publish")]:true};
  for(const record of [hidden,accessor,symbol,
   {...sources[0],providerReceipt:"sent"},
   {...sources[3],currency:"USD",customerEmail:"private@example.com"},
   {...sources[0],eventType:"REQUEST_CREATED"},
  ]){
   const result=proposeF06TypedEvent(input(record));
   expect(result).toMatchObject({ok:false,code:"F06_EVENT_INPUT_INVALID"});
   expect(JSON.stringify(result)).not.toContain("private@example.com");
  }
  const key=Object.defineProperty(input(sources[0]),"autoPublish",{
   value:true,enumerable:false,
  });
  expect(proposeF06TypedEvent(key)).toMatchObject({
   ok:false,code:"F06_EVENT_INPUT_INVALID",
  });
 });
 it("rejects noninteger versions, invalid clock and fabricated permissions without throwing",()=>{
  for(const value of [
   {...input(sources[0]),expectedSourceVersion:1.5},
   {...input(sources[0]),observedAt:"2026-02-30T00:00:00Z"},
   {...input(sources[0]),record:{...sources[0],sourceId:"bad id with spaces"}},
   {...input(sources[0]),record:{...sources[0],sourceVersion:Infinity}},
   {...input(sources[0]),actor:{...actor,providerCanSend:true}},
  ])expect(proposeF06TypedEvent(value).ok).toBe(false);
 });
});
