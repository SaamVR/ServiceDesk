import {describe,expect,it} from "vitest";
import {proposeSonicF09Event} from "../../src/server/ai/sonic-f09-event-families";
import {draftSonicF09Action,SONIC_F09_ACTION_TYPES} from "../../src/server/ai/sonic-f09-internal-actions";
const eventInput={
 actor:{workspaceId:"tenant_a",role:"OWNER"},
 workspaceId:"tenant_a",branchId:"branch_a",
 asOf:"2026-10-26T06:00:00Z",expectedVersion:1,
 record:{kind:"MESSAGE_RECEIVED",workspaceId:"tenant_a",branchId:"branch_a",
  sourceId:"msg_001",sourceVersion:1,status:"RECEIVED",channel:"EMAIL",
  receivedAt:"2026-10-26T03:00:00Z",messageId:"mail_01"},
};
const event=proposeSonicF09Event(eventInput);
if(!event.ok)throw Error("test event invalid");
const fingerprint=event.value.fingerprint;
const intentCases=[
 {kind:"SET_INTERNAL_PRIORITY",attentionId:"attention_01",priority:"HIGH"},
 {kind:"CREATE_DRAFT_REPLY",channel:"EMAIL",templateCode:"CLARIFY_DETAILS"},
 {kind:"SUGGEST_SLOT",crewId:"crew_01",suggestedStartAt:"2026-10-27T08:00:00Z"},
 {kind:"START_N8N_APPROVED_JOB",approvedJobCode:"OWNER_AUDIT_EXPORT"},
] as const;
const input=(intent:unknown,expectedEventFingerprint=fingerprint)=>({
 eventInput,intent,expectedEventFingerprint,
});
describe("SONIC F09 four new internal action drafts",()=>{
 it("covers exactly the missing actions without importing external workflow writers",()=>{
  expect(intentCases.map(x=>x.kind)).toEqual(SONIC_F09_ACTION_TYPES);
 });
 it.each(intentCases)("builds safe deterministic $kind draft but runs nothing",intent=>{
  const result=draftSonicF09Action(input(intent));
  expect(result.ok).toBe(true);
  if(!result.ok)return;
  expect(result.value).toMatchObject({
   state:"UNPERSISTED_F09_INTERNAL_ACTION_DRAFT",kind:intent.kind,
   workspaceId:"tenant_a",branchId:"branch_a",
   executed:false,saved:false,scheduled:false,n8nCalled:false,
   appointmentConfirmed:false,customerMessageSent:false,providerCalled:false,
   financialStateChanged:false,ownerApprovalRequired:true,
   sourceAuthenticated:false,branchAuthorityRequiresFreshRead:true,
   idempotentWriterUnavailable:true,
  });
  expect(result.value.actionFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(draftSonicF09Action(input(intent))).toEqual(result);
 });
 it("does not trust a copied or stale source fingerprint",()=>{
  expect(draftSonicF09Action(input(intentCases[0],"a".repeat(64))))
   .toMatchObject({ok:false,code:"F09_ACTION_STALE"});
  expect(draftSonicF09Action(input(intentCases[0],"hello")))
   .toMatchObject({ok:false,code:"F09_ACTION_INVALID"});
  const fake={...eventInput,expectedVersion:2};
  expect(draftSonicF09Action({eventInput:fake,intent:intentCases[0],
    expectedEventFingerprint:fingerprint}))
   .toMatchObject({ok:false,code:"F09_ACTION_SOURCE_UNVERIFIED"});
 });
 it("rejects N8N arbitrary URL, unallowlisted job, webhook or execute flag",()=>{
  for(const intent of [
   {kind:"START_N8N_APPROVED_JOB",approvedJobCode:"https://evil.example/"},
   {kind:"START_N8N_APPROVED_JOB",approvedJobCode:"OWNER_AUDIT_EXPORT",execute:true},
   {kind:"START_N8N_APPROVED_JOB",approvedJobCode:"UNKNOWN"},
  ])expect(draftSonicF09Action(input(intent)))
    .toMatchObject({ok:false,code:"F09_ACTION_INVALID"});
 });
 it("rejects raw recipient/message body, payment and privilege escalation",()=>{
  for(const intent of [
   {kind:"CREATE_DRAFT_REPLY",channel:"EMAIL",templateCode:"CLARIFY_DETAILS",
    recipient:"alice@example.test"},
   {kind:"CREATE_DRAFT_REPLY",channel:"SMS",templateCode:"CLARIFY_DETAILS"},
   {kind:"SET_INTERNAL_PRIORITY",attentionId:"attention_01",priority:"ADMIN"},
   {kind:"SUGGEST_SLOT",crewId:"crew_01",suggestedStartAt:"2026-10-27T08:00:00Z",
    confirmBooking:true},
  ])expect(draftSonicF09Action(input(intent)))
   .toMatchObject({ok:false,code:"F09_ACTION_INVALID"});
 });
 it("rejects past, unzoned and excessive future appointment suggestions",()=>{
  for(const t of ["2026-10-25T08:00:00Z","2026-11-29T08:00:00Z","2026-10-29T08:00:00"]){
   const action=draftSonicF09Action(input({kind:"SUGGEST_SLOT",crewId:"crew_01",suggestedStartAt:t}));
   expect(action.ok).toBe(false);
  }
 });
 it("rejects foreign tenant, changed actor and getter-bearing intent",()=>{
  expect(draftSonicF09Action({eventInput:{
    ...eventInput,actor:{workspaceId:"tenant_b",role:"OWNER"}},
    intent:intentCases[0],expectedEventFingerprint:fingerprint}))
   .toMatchObject({ok:false,code:"F09_ACTION_SOURCE_UNVERIFIED"});
  const bad={kind:"SET_INTERNAL_PRIORITY",attentionId:"attention_01",priority:"HIGH"};
  Object.defineProperty(bad,"priority",{get(){throw Error("forbidden");},enumerable:true});
  expect(draftSonicF09Action(input(bad)))
   .toMatchObject({ok:false,code:"F09_ACTION_INVALID"});
 });
});
