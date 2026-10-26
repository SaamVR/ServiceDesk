import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadVerifiedOwnerWorkspace } from "../../src/features/auth/verified-owner-workspace";

const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const workspaceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const foreignId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const slug = "qa-cleaning";
const workspace = { id: workspaceId, slug, name: "QA Cleaning",
  timezone: "Asia/Dhaka", currency: "BDT" };
const ownerMembership = (id=workspaceId)=>({
  workspace_id:id,user_id:user,role:"OWNER",status:"ACTIVE",
});
interface Flags {
  userId?:string|null; userError?:boolean; userThrow?:boolean;
  membersError?:boolean;membersThrow?:boolean;
  workspaceError?:boolean;workspaceThrow?:boolean;
}
function fakeAuth(
  members: unknown,
  selectedWorkspace: unknown,
  flags: Flags = {},
) {
  const calls: string[] = [];
  const membershipQuery = {
    select(columns:string) {
      expect(columns).toBe("workspace_id,user_id,role,status");
      return this;
    },
    eq() { return this; },
    async limit() {
      if(flags.membersThrow)throw Error("private member transport failed");
      return { data: members, error: flags.membersError ? { code: "42501" } : null };
    },
  };
  const workspaceQuery = {
    select() { return this; },
    in() { calls.push("workspace-read"); return this; },
    eq() { return this; },
    async maybeSingle() {
      if(flags.workspaceThrow)throw Error("private workspace transport failed");
      return { data: selectedWorkspace,
        error: flags.workspaceError ? { code: "42501" } : null };
    },
  };
  const auth = {
    auth:{
      async getUser(){
        calls.push("authenticated-user");
        if(flags.userThrow)throw Error("private auth transport failed");
        return {data:{user:flags.userId===null?null:{id:flags.userId??user}},
          error:flags.userError?{code:"401"}:null};
      },
    },
    from(table: string) {
      calls.push(table);
      if (table === "memberships") return membershipQuery;
      if (table === "workspaces") return workspaceQuery;
      throw Error("unanticipated table " + table);
    },
  } as unknown as SupabaseClient;
  return { auth, calls };
}

describe("P02 verified owner workspace readback cannot accept partial/corrupt tenant evidence", () => {
  it("accepts only the signed-in owner and full active saved membership", async () => {
    const { auth, calls } = fakeAuth([ownerMembership()], workspace);
    expect(await loadVerifiedOwnerWorkspace(auth, user, slug))
      .toEqual({ ok: true, workspace });
    expect(calls).toEqual([
      "authenticated-user", "memberships", "workspaces", "workspace-read",
    ]);
  });
  it("denies a foreign or unavailable authenticated session without querying tenant rows", async () => {
    for(const flags of [
      {userId:foreignId}, {userId:null}, {userError:true}, {userThrow:true},
    ]){
      const {auth,calls}=fakeAuth([ownerMembership()],workspace,flags);
      expect((await loadVerifiedOwnerWorkspace(auth,user,slug)).ok).toBe(false);
      expect(calls).toEqual(["authenticated-user"]);
    }
    const invalid=fakeAuth([ownerMembership()],workspace);
    expect(await loadVerifiedOwnerWorkspace(invalid.auth,"not-a-uuid",slug))
      .toEqual({ok:false,reason:"INVALID"});
    expect(invalid.calls).toEqual([]);
  });
  it("fails closed before reading workspaces when membership rows are partial or corrupt", async () => {
    for (const broken of [
      null, undefined, "unexpected", [ownerMembership(), null],
      [ownerMembership(), ownerMembership("not-a-uuid")],
      [ownerMembership(), { ...ownerMembership(), workspace_id: "" }],
      [ownerMembership(), { ...ownerMembership(), workspace_id: foreignId.slice(1) }],
      [ownerMembership(), { ...ownerMembership(), user_id: foreignId }],
      [ownerMembership(), { ...ownerMembership(), role: "STAFF" }],
      [ownerMembership(), { ...ownerMembership(), status: "REVOKED" }],
      [ownerMembership(), ownerMembership()], [{ workspace_id: workspaceId }],
      [{ ...ownerMembership(), workspace_id: 42 }], [{}],
    ]) {
      const { auth, calls } = fakeAuth(broken, workspace);
      expect(await loadVerifiedOwnerWorkspace(auth, user, slug))
        .toEqual({ ok: false, reason: "QUERY_FAILED" });
      expect(calls).toEqual(["authenticated-user", "memberships"]);
    }
  });
  it("denies a foreign slug and refuses incorrectly shaped workspace readback", async () => {
    for (const bad of [
      { ...workspace, id: foreignId }, { ...workspace, slug: "other-business" },
      { ...workspace, name: "" }, { ...workspace, timezone: null },
      { ...workspace, currency: "usd" }, { ...workspace, currency: "USDD" },
      { ...workspace, id: "bad" },
    ]) {
      expect(await loadVerifiedOwnerWorkspace(
        fakeAuth([ownerMembership()], bad).auth, user, slug,
      )).not.toMatchObject({ ok: true });
    }
    expect(await loadVerifiedOwnerWorkspace(
      fakeAuth([ownerMembership()], null).auth, user, slug,
    )).toEqual({ ok: false, reason: "DENIED" });
  });
  it("propagates real auth/RLS and transport failures without granting a workspace", async () => {
    const members = [ownerMembership()];
    for(const flags of [
      {membersError:true},{membersThrow:true},
      {workspaceError:true},{workspaceThrow:true},
    ]){
      const result=await loadVerifiedOwnerWorkspace(
        fakeAuth(members,workspace,flags).auth,user,slug,
      );
      expect(result).toEqual({ok:false,reason:"QUERY_FAILED"});
    }
  });
});
