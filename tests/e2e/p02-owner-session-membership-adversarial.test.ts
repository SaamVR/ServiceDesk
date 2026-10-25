import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadVerifiedOwnerWorkspace } from "../../src/features/auth/verified-owner-workspace";

const owner="11111111-1111-4111-8111-111111111111";
const attacker="22222222-2222-4222-8222-222222222222";
const workspaceId="33333333-3333-4333-8333-333333333333";
const foreign="44444444-4444-4444-8444-444444444444";
const slug="approved-cleaning";
const clean={id:workspaceId,slug,name:"Approved QA workspace",
  timezone:"Asia/Dhaka",currency:"BDT"};
const owned={workspace_id:workspaceId,user_id:owner,role:"OWNER",status:"ACTIVE"};

function authResponse(config:{
 signedIn?:string|null;
 membership?:unknown;
 selected?:unknown;
 authFailed?:boolean;
 memberFailed?:boolean;
 workspaceFailed?:boolean;
}) {
 const calls:string[]=[];
 const auth={
  auth:{async getUser(){
    calls.push("verified-session");
    if(config.authFailed)throw Error("PRIVATE_ACCOUNT_ERROR");
    return {data:{user:config.signedIn===null?null:{id:config.signedIn??owner}},error:null};
  }},
  from(table:string){
   calls.push(table);
   if(table==="memberships"){
    const filters:Array<[string,unknown]>=[];
    return {
     select(fields:string){
      expect(fields).toBe("workspace_id,user_id,role,status");
      return this;
     },
     eq(field:string,value:unknown){filters.push([field,value]);return this;},
     async limit(value:number){
      expect(value).toBe(21);
      expect(filters).toEqual([
       ["user_id",owner],["role","OWNER"],["status","ACTIVE"],
      ]);
      if(config.memberFailed)throw Error("PRIVATE_MEMBERSHIP_ERROR");
      return {data:config.membership??[owned],error:null};
     },
    };
   }
   if(table==="workspaces"){
    const filters:Array<[string,unknown]>=[];
    return {
     select(fields:string){
      expect(fields).toBe("id,slug,name,timezone,currency");
      return this;
     },
     in(field:string,ids:string[]){
      expect(field).toBe("id");
      expect(ids).toEqual([workspaceId]);
      return this;
     },
     eq(field:string,value:unknown){filters.push([field,value]);return this;},
     async maybeSingle(){
      expect(filters).toEqual([["slug",slug]]);
      if(config.workspaceFailed)throw Error("PRIVATE_WORKSPACE_ERROR");
      return {data:config.selected??clean,error:null};
     },
    };
   }
   throw Error("UNEXPECTED_TABLE");
  },
 } as unknown as SupabaseClient;
 return {auth,calls};
}

describe("P02 real session and saved owner row are independent authorization gates",()=>{
 it("accepts only a consistent signed-in OWNER and the corresponding saved workspace",async()=>{
  const f=authResponse({});
  expect(await loadVerifiedOwnerWorkspace(f.auth,owner,slug))
   .toEqual({ok:true,workspace:clean});
  expect(f.calls).toEqual(["verified-session","memberships","workspaces"]);
 });
 it("a forged caller-chosen owner ID cannot select another user's workspace",async()=>{
  const f=authResponse({signedIn:attacker});
  expect(await loadVerifiedOwnerWorkspace(f.auth,owner,slug))
   .toEqual({ok:false,reason:"DENIED"});
  expect(f.calls).toEqual(["verified-session"]);
 });
 it("revoked, staff, other subject and foreign membership readbacks fail closed",async()=>{
  const tampered=[
   {...owned,role:"STAFF"},
   {...owned,status:"INACTIVE"},
   {...owned,user_id:attacker},
   {...owned,workspace_id:foreign},
  ];
  for(const membership of tampered){
   const f=authResponse({membership:[membership]});
   expect(await loadVerifiedOwnerWorkspace(f.auth,owner,slug))
    .toEqual({ok:false,reason:"QUERY_FAILED"});
   expect(f.calls).toEqual(["verified-session","memberships"]);
  }
 });
 it("mixed good and poisoned rows or duplicate membership cannot authorize",async()=>{
  for(const membership of [
   [owned,{...owned,user_id:attacker}],
   [owned,{...owned,workspace_id:foreign}],
   [owned,{...owned}],
  ]){
   const f=authResponse({membership});
   expect(await loadVerifiedOwnerWorkspace(f.auth,owner,slug))
    .toEqual({ok:false,reason:"QUERY_FAILED"});
   expect(f.calls).not.toContain("workspaces");
  }
 });
 it("transport exceptions and unexpected membership result never leak private failures",async()=>{
  for(const scenario of [
   {authFailed:true},
   {memberFailed:true},
   {workspaceFailed:true},
   {membership:"forged-string"},
  ]){
   const f=authResponse(scenario);
   const result=await loadVerifiedOwnerWorkspace(f.auth,owner,slug);
   expect(result.ok).toBe(false);
   expect(JSON.stringify(result)).not.toContain("PRIVATE_");
  }
 });
 it("workspace success cannot be claimed from a different or malformed tenant response",async()=>{
  for(const selected of [
   {...clean,id:foreign},{...clean,slug:"wrong-slug"},
   {...clean,currency:"NOT_VALID"},{...clean,timezone:null},
  ]){
   const f=authResponse({selected});
   expect(await loadVerifiedOwnerWorkspace(f.auth,owner,slug))
    .toEqual({ok:false,reason:"QUERY_FAILED"});
  }
 });
 it("rejects a caller-supplied non-UUID before any account/network lookup",async()=>{
  const f=authResponse({});
  expect(await loadVerifiedOwnerWorkspace(f.auth,"../../foreign",slug))
   .toEqual({ok:false,reason:"INVALID"});
  expect(f.calls).toEqual([]);
 });
});
