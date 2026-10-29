import {describe,expect,it} from "vitest";
import {SONIC_F09_EVENT_TYPES,proposeSonicF09Event} from "../../src/server/ai/sonic-f09-event-families";
import {SONIC_F09_ACTION_TYPES,draftSonicF09Action} from "../../src/server/ai/sonic-f09-internal-actions";
import {SONIC_F09_RECIPE_KINDS,planSonicF09OperationalRecipe} from "../../src/server/ai/sonic-f09-operational-recipes";

const observedAt="2026-10-26T00:00:00Z";
const eventInput={
 actor:{workspaceId:"workspace_a",role:"OWNER"},workspaceId:"workspace_a",
 branchId:"branch_a",asOf:observedAt,expectedVersion:3,
 record:{kind:"MESSAGE_RECEIVED",workspaceId:"workspace_a",branchId:"branch_a",
  sourceId:"source_01",sourceVersion:3,status:"RECEIVED",channel:"EMAIL",
  receivedAt:"2026-10-25T23:00:00Z",messageId:"msg_01"},
};
describe("SONIC F09 integrated critic: source types do not authorize a business mutation",()=>{
 it("exposes all 8 missing events, all 4 actions and 4 operational policies without duplicating names",()=>{
  expect(new Set(SONIC_F09_EVENT_TYPES).size).toBe(8);
  expect(new Set(SONIC_F09_ACTION_TYPES).size).toBe(4);
  expect(new Set(SONIC_F09_RECIPE_KINDS).size).toBe(4);
  expect(SONIC_F09_EVENT_TYPES).not.toContain("QUOTE_EXPIRED");
  expect(SONIC_F09_ACTION_TYPES).not.toContain("CREATE_TASK");
 });
 it("joins event→safe internal reply only by identical source fingerprint, never sends",()=>{
  const event=proposeSonicF09Event(eventInput);
  expect(event.ok).toBe(true);
  if(!event.ok)return;
  const action=draftSonicF09Action({eventInput,
   expectedEventFingerprint:event.value.fingerprint,
   intent:{kind:"CREATE_DRAFT_REPLY",channel:"EMAIL",templateCode:"CLARIFY_DETAILS"}});
  expect(action.ok).toBe(true);
  if(!action.ok)return;
  expect(action.value).toMatchObject({
   kind:"CREATE_DRAFT_REPLY",workspaceId:"workspace_a",sourceVersion:3,
   sourceAuthenticated:false,customerMessageSent:false,
   providerCalled:false,executed:false,saved:false,ownerApprovalRequired:true,
  });
  const changed={...eventInput,record:{...eventInput.record,messageId:"msg_other"}};
  expect(draftSonicF09Action({eventInput:changed,
   expectedEventFingerprint:event.value.fingerprint,
   intent:{kind:"CREATE_DRAFT_REPLY",channel:"EMAIL",templateCode:"CLARIFY_DETAILS"}}))
   .toMatchObject({ok:false,code:"F09_ACTION_STALE"});
 });
 it("rejects cross-tenant event reuse before N8N job or reply intent",()=>{
  const event=proposeSonicF09Event(eventInput);
  if(!event.ok)throw Error("test source invalid");
  expect(draftSonicF09Action({eventInput:{...eventInput,branchId:"branch_b"},
   expectedEventFingerprint:event.value.fingerprint,
   intent:{kind:"START_N8N_APPROVED_JOB",approvedJobCode:"OWNER_AUDIT_EXPORT"}}))
    .toMatchObject({ok:false,code:"F09_ACTION_SOURCE_UNVERIFIED"});
 });
 it("owner-review automation does not create a task, merge leads or contact users",()=>{
  const result=planSonicF09OperationalRecipe({
   actor:{workspaceId:"workspace_a",role:"OWNER"},workspaceId:"workspace_a",
   branchId:"branch_a",asOf:observedAt,expectedVersion:3,
   record:{kind:"DUPLICATE_LEAD_REVIEW",workspaceId:"workspace_a",
    branchId:"branch_a",sourceId:"lead_001",sourceVersion:3,
    status:"OPEN",matchedLeadId:"lead_002",
    matchEvidence:"SAVED_CONTACT_HASH_MATCH"},
  });
  expect(result.ok).toBe(true);
  if(!result.ok)return;
  expect(result.value).toMatchObject({
   outcome:"REVIEW_SUGGESTED",proposedInternalTask:"REVIEW_POSSIBLE_DUPLICATE",
   saved:false,executed:false,merged:false,customerContacted:false,
   providerCalled:false,moneyChanged:false,ownerApprovalRequired:true,
  });
 });
});
