import test from "node:test";
import assert from "node:assert/strict";
import {
  operationalProofTables, verifyTwoTenantOperationalRls,
} from "./v4-operational-rls-positive-negative.mjs";

const ownerA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ownerB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function client(rows, denyTable) {
  return {
    from(table) {
      let workspace;
      return {
        select(column) {
          assert.equal(column, "workspace_id");
          return this;
        },
        eq(key, value) {
          assert.equal(key, "workspace_id");
          workspace = value;
          return this;
        },
        async limit(n) {
          assert.equal(n, 1);
          if (table === denyTable) return { data: null, error: { code: "42501" } };
          return {
            data: (rows[table] ?? []).filter(r => r.workspace_id === workspace).slice(0,1),
            error: null,
          };
        },
      };
    },
  };
}
const ownRows = (id) => Object.fromEntries(
  operationalProofTables.map(table => [table,[{workspace_id:id}]]),
);
const actor = (id, rows, denyTable) => ({id, client:client(rows,denyTable)});
const fail = code => { throw new Error(code); };

test("five selected rows form the authenticated operational proof matrix", () => {
  assert.deepEqual([...operationalProofTables], [
    "service_catalog", "branch_price_books", "requests", "quotes",
    "workflow_rule_versions",
  ]);
});
test("two owners with positive own rows and zero foreign rows pass in both directions", async () => {
  const a=actor(ownerA,ownRows(ownerA)), b=actor(ownerB,ownRows(ownerB));
  await verifyTwoTenantOperationalRls(a,b,fail);
  await verifyTwoTenantOperationalRls(b,a,fail);
});
test("all-empty workspaces never fake successful cross-tenant RLS", async () => {
  const a=actor(ownerA,{}),b=actor(ownerB,{});
  await assert.rejects(
    verifyTwoTenantOperationalRls(a,b,fail),
    /MISSING_OWN_OPERATIONAL_ROW_SERVICE_CATALOG/,
  );
});
test("a partially populated workspace is blocked for the exact missing contract", async () => {
  const rows=ownRows(ownerA);
  rows["branch_price_books"]=[];
  await assert.rejects(
    verifyTwoTenantOperationalRls(actor(ownerA,rows),actor(ownerB,{}),fail),
    /MISSING_OWN_OPERATIONAL_ROW_BRANCH_PRICE_BOOKS/,
  );
});
test("exposed foreign-tenant records fail even when own records are present", async () => {
  const rows=ownRows(ownerA);
  rows["quotes"].push({workspace_id:ownerB});
  await assert.rejects(
    verifyTwoTenantOperationalRls(actor(ownerA,rows),actor(ownerB,{}),fail),
    /FOREIGN_OPERATIONAL_ROW_EXPOSED_QUOTES/,
  );
});
test("permission failures are not misclassified as successful empty foreign reads", async () => {
  await assert.rejects(
    verifyTwoTenantOperationalRls(
      actor(ownerA,ownRows(ownerA),"requests"),actor(ownerB,{}),fail),
    /MISSING_OWN_OPERATIONAL_ROW_REQUESTS/,
  );
});
test("same-tenant or unverified actor cannot pass as two separate customers", async () => {
  const a=actor(ownerA,ownRows(ownerA));
  await assert.rejects(
    verifyTwoTenantOperationalRls(a,a,fail),
    /DISTINCT_ACTORS_REQUIRED/,
  );
});
