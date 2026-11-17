import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isSavedActiveOwnerMembership} from "../v4-p02-real-owner-membership-assertion.mjs";

const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const WA="33333333-3333-4333-8333-333333333333";
const WB="44444444-4444-4444-8444-444444444444";
const own={workspace_id:WA,user_id:A,role:"OWNER",status:"ACTIVE"};
const expected={workspaceId:WA,userId:A};

test("real-session membership witness accepts exactly saved ACTIVE OWNER subject and scope",()=>{
 assert.equal(isSavedActiveOwnerMembership(own,expected),true);
 assert.equal(isSavedActiveOwnerMembership(
   {workspace_id:WB,user_id:B,role:"OWNER",status:"ACTIVE"},
   {workspaceId:WB,userId:B}),true);
});
for(const [scenario,entry,actor] of [
 ["foreign workspace",{...own,workspace_id:WB},expected],
 ["wrong subject",{...own,user_id:B},expected],
 ["revoked",{...own,status:"REVOKED"},expected],
 ["invited",{...own,status:"INVITED"},expected],
 ["staff",{...own,role:"DISPATCHER"},expected],
 ["crew",{...own,role:"CREW"},expected],
 ["missing subject",{workspace_id:WA,role:"OWNER",status:"ACTIVE"},expected],
 ["missing status",{workspace_id:WA,user_id:A,role:"OWNER"},expected],
 ["missing role",{workspace_id:WA,user_id:A,status:"ACTIVE"},expected],
 ["fabricated all fields",{...own,role:"owner"},expected],
 ["null receipt",null,expected],
 ["array receipt",[own],expected],
 ["undefined owner context",own,undefined],
 ["unverified caller ID",own,{workspaceId:WA,userId:"not-a-uuid"}],
 ["unverified workspace ID",own,{workspaceId:"not-a-uuid",userId:A}],
 ["different signed-in subject",own,{workspaceId:WA,userId:B}],
 ["different owner workspace",own,{workspaceId:WB,userId:A}],
 ])test("denies "+scenario,()=>{
 assert.equal(isSavedActiveOwnerMembership(entry,actor),false);
});
test("the protected real RLS runner MUST select and independently check saved owner identity, role and status",()=>{
 const script=readFileSync("scripts/release/v4-private-rls-proof.mjs","utf8");
 assert.ok(script.includes('.select("workspace_id,user_id,role,status")'));
 assert.ok(script.includes("isSavedActiveOwnerMembership(membership.data"));
 assert.ok(script.includes('verified.user.id'));
 assert.ok(script.includes('fail("OWNER_MEMBERSHIP")'));
 assert.ok(!script.includes('service_role'));
});
