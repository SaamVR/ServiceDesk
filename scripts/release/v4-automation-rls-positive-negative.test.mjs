import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyTwoTenantAutomationRls, automationProofTables } from "./v4-automation-rls-positive-negative.mjs";

const A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function actor(id,userId,options={}) {
  const calls=[];
  return {id,userId,calls,client:{from(table) {
    let selected="", workspace="", limit=0;
    const chain={
      select(v){selected=v;return chain;},
      eq(key,v){assert.equal(key,"workspace_id");workspace=v;return chain;},
      async limit(v) {
        limit=v;calls.push({table,selected,workspace,limit});
        if(options.error && workspace===id) return {data:null,error:{message:"denied"}};
        if(options.missing && workspace===id && table===options.missing) return {data:[],error:null};
        if(options.leak && workspace!==id && table===options.leak) return {data:[{workspace_id:workspace}],error:null};
        return {data:workspace===id?[{workspace_id:id}]:[],error:null};
      },
    };return chain;
  }}};
}
const check=(a,b)=>verifyTwoTenantAutomationRls(a,b,(code)=>{throw Error(code);});

test("requires all three genuinely persisted own operational automation row types",async()=>{
  const a=actor(A,"user-a"),b=actor(B,"user-b");
  await check(a,b);await check(b,a);
  assert.deepEqual(automationProofTables,["workflow_executions","workflow_action_executions","attention_items"]);
  assert.equal(a.calls.length,6);
  assert(a.calls.every(x=>x.selected==="workspace_id"&&x.limit===1));
});

test("rejects vacuous empty owner evidence on each required table",async()=>{
  for(const missing of automationProofTables){
    await assert.rejects(check(actor(A,"user-a",{missing}),actor(B,"user-b")),
      new RegExp("MISSING_OWN_AUTOMATION_ROW_"+missing.toUpperCase()));
  }
});

test("rejects cross-workspace execution and attention leakage",async()=>{
  for(const leak of automationProofTables){
    await assert.rejects(check(actor(A,"user-a",{leak}),actor(B,"user-b")),
      new RegExp("FOREIGN_AUTOMATION_ROW_EXPOSED_"+leak.toUpperCase()));
  }
});

test("does not accept a single person owning two workspaces",async()=>{
  await assert.rejects(check(actor(A,"user-a"),actor(B,"user-a")),/DISTINCT_AUTOMATION_OWNERS_REQUIRED/);
  await assert.rejects(check(actor(A,"user-a"),actor(A,"user-b")),/DISTINCT_AUTOMATION_OWNERS_REQUIRED/);
  await assert.rejects(check(actor(A,undefined),actor(B,"user-b")),/DISTINCT_AUTOMATION_OWNERS_REQUIRED/);
});

test("treats own-row errors as blocked, never a passing empty dataset",async()=>{
  await assert.rejects(check(actor(A,"user-a",{error:true}),actor(B,"user-b")),
    /MISSING_OWN_AUTOMATION_ROW_WORKFLOW_EXECUTIONS/);
});
