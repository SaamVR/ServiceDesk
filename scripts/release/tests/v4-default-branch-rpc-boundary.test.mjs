import test from "node:test";
import assert from "node:assert/strict";
import {
  readAuthenticatedOwnerDefaultBranch, verifyTwoOwnerDefaultBranchRpcBoundary,
} from "../v4-default-branch-rpc-boundary.mjs";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaabbbb";
const BB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbaaaa";
const fail = code => { throw Error(code); };
function actor(id, branch, settings = {}) {
  return {
    id, userId: settings.userId ?? id,
    client: {
      from(table) {
        assert.equal(table, "workspace_branches");
        const filters = {};
        return {
          select(projection) {
            assert.equal(projection, "id,workspace_id,is_default,active");
            return this;
          },
          eq(k, v) { filters[k] = v; return this; },
          async limit(n) {
            assert.equal(n, 2);
            assert.deepEqual(filters, {workspace_id:id,is_default:true,active:true});
            if (settings.dbError) return {data:null,error:{code:"42501"}};
            if (settings.empty) return {data:[],error:null};
            const row = {id:branch,workspace_id:id,is_default:true,active:true};
            return {data:settings.duplicate?[row,row]:[row],error:null};
          },
        };
      },
      async rpc(name, args) {
        assert.equal(name, "servicedesk_default_branch");
        assert.deepEqual(Object.keys(args), ["target_workspace"]);
        if (args.target_workspace === id) {
          return settings.ownRpcError
            ? {data:null,error:{code:"42501"}}
            : {data:settings.wrongOwn ? B : branch,error:null};
        }
        if (settings.foreignError) return {data:null,error:{code:settings.foreignError}};
        return {data:settings.leakForeign ?? null,error:null};
      },
    },
  };
}
const pair = (sa={},sb={}) => [
  actor(A,AB,sa),actor(B,BB,sb),
];

test("accepts two distinct owners, each with a real own branch and foreign null", async () => {
  assert.equal(await verifyTwoOwnerDefaultBranchRpcBoundary(...pair(),fail),true);
});
test("accepts an explicit foreign permission denial but not arbitrary RPC errors", async () => {
  assert.equal(await verifyTwoOwnerDefaultBranchRpcBoundary(...pair({foreignError:"42501"}),fail),true);
  await assert.rejects(
    verifyTwoOwnerDefaultBranchRpcBoundary(...pair({foreignError:"PGRST202"}),fail),
    /DEFAULT_BRANCH_FOREIGN_RPC_EXPOSURE_OR_UNVERIFIED/,
  );
});
test("rejects the existing unscoped definer behavior leaking foreign branch ID", async () => {
  await assert.rejects(
    verifyTwoOwnerDefaultBranchRpcBoundary(...pair({leakForeign:BB}),fail),
    /DEFAULT_BRANCH_FOREIGN_RPC_EXPOSURE_OR_UNVERIFIED/,
  );
});
test("rejects a wrong authorized-owner branch identity", async () => {
  await assert.rejects(
    verifyTwoOwnerDefaultBranchRpcBoundary(...pair({wrongOwn:true}),fail),
    /DEFAULT_BRANCH_OWN_RPC_NOT_VERIFIED/,
  );
  await assert.rejects(
    verifyTwoOwnerDefaultBranchRpcBoundary(...pair({ownRpcError:true}),fail),
    /DEFAULT_BRANCH_OWN_RPC_NOT_VERIFIED/,
  );
});
test("refuses vacuous cross-tenant negative when either real branch is missing", async () => {
  await assert.rejects(
    verifyTwoOwnerDefaultBranchRpcBoundary(...pair({empty:true}),fail),
    /DEFAULT_BRANCH_OWN_ROW_NOT_UNAMBIGUOUS/,
  );
  await assert.rejects(
    verifyTwoOwnerDefaultBranchRpcBoundary(...pair({}, {empty:true}),fail),
    /DEFAULT_BRANCH_OWN_ROW_NOT_UNAMBIGUOUS/,
  );
});
test("rejects ambiguous duplicate defaults and failed own owner row reads", async () => {
  await assert.rejects(
    verifyTwoOwnerDefaultBranchRpcBoundary(...pair({duplicate:true}),fail),
    /DEFAULT_BRANCH_OWN_ROW_NOT_UNAMBIGUOUS/,
  );
  await assert.rejects(
    readAuthenticatedOwnerDefaultBranch(actor(A,AB,{dbError:true}),fail),
    /DEFAULT_BRANCH_OWN_ROW_NOT_UNAMBIGUOUS/,
  );
});
test("different workspaces owned by the same user are not a two-owner proof", async () => {
  await assert.rejects(
    verifyTwoOwnerDefaultBranchRpcBoundary(...pair({userId:"one"},{userId:"one"}),fail),
    /DEFAULT_BRANCH_TWO_DISTINCT_OWNERS_REQUIRED/,
  );
});
test("missing authenticated owner context and identical tenant are rejected", async () => {
  await assert.rejects(
    verifyTwoOwnerDefaultBranchRpcBoundary(...pair({userId:""},{userId:"two"}),fail),
    /DEFAULT_BRANCH_TWO_DISTINCT_OWNERS_REQUIRED/,
  );
  const a=actor(A,AB);
  await assert.rejects(
    verifyTwoOwnerDefaultBranchRpcBoundary(a,a,fail),
    /DEFAULT_BRANCH_TWO_DISTINCT_OWNERS_REQUIRED/,
  );
});
