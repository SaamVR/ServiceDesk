import { describe, expect, it } from "vitest";
import {
  resolveAuthorizedWorkspaceDestination,
  resolveAuthorizedStaffWorkspaceSelection,
  type AuthorizedWorkspaceMembership,
} from "../../src/domain/auth/authorized-workspace-selection";

function member(
  role: "OWNER" | "DISPATCHER" | "CREW",
  workspaceId: string,
  overrides: Partial<AuthorizedWorkspaceMembership> = {},
): AuthorizedWorkspaceMembership {
  return {
    workspaceId,
    slug: "clean-" + workspaceId,
    name: "Cleaning " + workspaceId,
    role,
    status: "ACTIVE",
    ...overrides,
  };
}

describe("authenticated RLS membership destination resolver", () => {
  it("never grants a destination without a matching active membership", () => {
    expect(resolveAuthorizedWorkspaceDestination([])).toEqual({ kind: "NONE" });
    expect(resolveAuthorizedWorkspaceDestination([
      member("OWNER", "old", { status: "REVOKED" }),
      member("DISPATCHER", "pending", { status: "INVITED" }),
    ])).toEqual({ kind: "NONE" });
  });

  it("routes a single active owner to their workspace", () => {
    expect(resolveAuthorizedWorkspaceDestination([member("OWNER", "a")])).toEqual({
      kind: "STAFF",
      workspace: {
        workspaceId: "a",
        slug: "clean-a",
        name: "Cleaning a",
        role: "OWNER",
        href: "/app/clean-a/overview",
      },
      href: "/app/clean-a/overview",
    });
  });

  it("routes a single dispatcher to their authorized workspace", () => {
    expect(resolveAuthorizedWorkspaceDestination([member("DISPATCHER", "b")])).toMatchObject({
      kind: "STAFF", href: "/app/clean-b/overview",
    });
  });

  it("requires a choice for two distinct staff workspaces", () => {
    const decision = resolveAuthorizedWorkspaceDestination([
      member("DISPATCHER", "office"),
      member("OWNER", "north"),
    ]);
    expect(decision.kind).toBe("CHOOSE");
    if (decision.kind === "CHOOSE") {
      expect(decision.workspaces.map(x => x.workspaceId)).toEqual(["north", "office"]);
      expect(decision.workspaces.map(x => x.role)).toEqual(["OWNER", "DISPATCHER"]);
    }
  });

  it("does not prompt unnecessarily for duplicate memberships of the same workspace", () => {
    const decision = resolveAuthorizedWorkspaceDestination([
      member("DISPATCHER", "one"),
      member("OWNER", "one"),
      member("OWNER", "one"),
    ]);
    expect(decision).toMatchObject({
      kind: "STAFF",
      workspace: { role: "OWNER" },
    });
  });

  it("falls back to the authorized crew route when no staff workspace exists", () => {
    expect(resolveAuthorizedWorkspaceDestination([
      member("CREW", "crew1"),
    ])).toEqual({ kind: "CREW", href: "/crew/today" });
  });

  it("never inserts crew entries into the staff switcher", () => {
    const result = resolveAuthorizedWorkspaceDestination([
      member("OWNER", "first"),
      member("DISPATCHER", "second"),
      member("CREW", "third"),
    ]);
    expect(result.kind).toBe("CHOOSE");
    if (result.kind === "CHOOSE") expect(result.workspaces).toHaveLength(2);
  });

  it("ignores slugs containing path traversal, percent escapes or protocol syntax", () => {
    const result = resolveAuthorizedWorkspaceDestination([
      member("OWNER", "a", { slug: "../../admin" }),
      member("OWNER", "b", { slug: "evil%2fexample" }),
      member("OWNER", "c", { slug: "//external" }),
      member("OWNER", "d", { slug: "https:evil" }),
      member("OWNER", "e", { slug: "legitimate-workspace" }),
    ]);
    expect(result).toMatchObject({
      kind: "STAFF",
      href: "/app/legitimate-workspace/overview",
    });
  });

  it("excludes malformed IDs and nonstaff role escalation attempts", () => {
    expect(resolveAuthorizedWorkspaceDestination([
      member("OWNER", "bad/workspace"),
      member("SUPERADMIN" as "OWNER", "admin"),
      member("OWNER", "valid"),
    ])).toMatchObject({ kind: "STAFF", href: "/app/clean-valid/overview" });
  });

  it("limits untrusted display names and falls back to safe slug", () => {
    const decision = resolveAuthorizedWorkspaceDestination([
      member("OWNER", "one", { name: " ", slug: "one-office" }),
    ]);
    expect(decision).toMatchObject({
      kind: "STAFF",
      workspace: { name: "one-office" },
    });
  });

  it("sorts staff choices stably even when input order changes", () => {
    const items = [
      member("DISPATCHER", "z", { name: "Zeta" }),
      member("OWNER", "b", { name: "Bravo" }),
      member("OWNER", "a", { name: "Alpha" }),
    ];
    const a = resolveAuthorizedWorkspaceDestination(items);
    const b = resolveAuthorizedWorkspaceDestination([...items].reverse());
    expect(a).toEqual(b);
    if (a.kind === "CHOOSE") {
      expect(a.workspaces.map(x => x.workspaceId)).toEqual(["a", "b", "z"]);
    }
  });
});

describe("explicit authorized staff workspace choice", () => {
  it("selects only the requested active staff workspace from multiple choices", () => {
    const rows = [member("OWNER", "north"), member("DISPATCHER", "south")];
    expect(resolveAuthorizedStaffWorkspaceSelection(rows, "south")).toMatchObject({
      kind: "STAFF",
      href: "/app/clean-south/overview",
      workspace: { workspaceId: "south", role: "DISPATCHER" },
    });
    expect(resolveAuthorizedStaffWorkspaceSelection(rows, "north")).toMatchObject({
      kind: "STAFF",
      workspace: { workspaceId: "north", role: "OWNER" },
    });
  });

  it("fails closed for an unknown, revoked or unsafe selection", () => {
    const rows = [
      member("OWNER", "active"),
      member("OWNER", "revoked", { status: "REVOKED" }),
      member("CREW", "crew-only"),
    ];
    for (const requested of ["unknown", "revoked", "crew-only", "../active", "clean-active", "", " active"]) {
      expect(resolveAuthorizedStaffWorkspaceSelection(rows, requested)).toEqual({ kind: "NONE" });
    }
  });

  it("selects the highest authorized role without mutating input", () => {
    const rows = [member("DISPATCHER", "one"), member("OWNER", "one")];
    const before = JSON.stringify(rows);
    expect(resolveAuthorizedStaffWorkspaceSelection(rows, "one")).toMatchObject({
      kind: "STAFF",
      workspace: { role: "OWNER" },
    });
    expect(JSON.stringify(rows)).toBe(before);
  });

  it("never turns crew access or missing membership into staff access", () => {
    expect(resolveAuthorizedStaffWorkspaceSelection([member("CREW", "crew")], "crew"))
      .toEqual({ kind: "NONE" });
    expect(resolveAuthorizedStaffWorkspaceSelection([], "new-business"))
      .toEqual({ kind: "NONE" });
  });
});

describe("duplicate authenticated membership integrity", () => {
  it("rejects a conflicting slug for one immutable workspace ID", () => {
    const rows = [
      member("OWNER", "same", { slug: "legitimate-one" }),
      member("DISPATCHER", "same", { slug: "different-one" }),
    ];
    expect(resolveAuthorizedWorkspaceDestination(rows)).toEqual({ kind: "NONE" });
    expect(resolveAuthorizedWorkspaceDestination([...rows].reverse())).toEqual({ kind: "NONE" });
    expect(resolveAuthorizedStaffWorkspaceSelection(rows, "same")).toEqual({ kind: "NONE" });
  });

  it("keeps unrelated authorized workspaces despite a conflicting joined row", () => {
    const rows = [
      member("OWNER", "a", { slug: "north-one" }),
      member("OWNER", "a", { slug: "north-two" }),
      member("OWNER", "b", { slug: "south-office" }),
    ];
    expect(resolveAuthorizedWorkspaceDestination(rows)).toMatchObject({
      kind: "STAFF", href: "/app/south-office/overview",
    });
  });

  it("stabilizes duplicate display names for equal authorized roles", () => {
    const rows = [
      member("OWNER", "one", { name: "Zeta" }),
      member("OWNER", "one", { name: "Alpha" }),
    ];
    for (const input of [rows, [...rows].reverse()]) {
      expect(resolveAuthorizedWorkspaceDestination(input)).toMatchObject({
        kind: "STAFF", workspace: { name: "Alpha", role: "OWNER" },
      });
    }
  });
});

describe("malformed authorized database projection resilience", () => {
  it("ignores null and non-string workspace identifiers without throwing", () => {
    for (const value of [null, 123, [], { nested: "one" }]) {
      const invalid = member("OWNER", "one", { workspaceId: value as unknown as string });
      expect(resolveAuthorizedWorkspaceDestination([invalid])).toEqual({ kind: "NONE" });
      expect(resolveAuthorizedStaffWorkspaceSelection([invalid], "one")).toEqual({ kind: "NONE" });
    }
  });

  it("skips malformed slugs and recovers a safe name fallback", () => {
    for (const slug of [null, undefined, {}, [], 123]) {
      expect(resolveAuthorizedWorkspaceDestination([
        member("OWNER", "one", { slug: slug as string }),
      ])).toEqual({ kind: "NONE" });
    }
    expect(resolveAuthorizedWorkspaceDestination([
      member("OWNER", "one", { name: null as unknown as string, slug: "north-office" }),
    ])).toMatchObject({ kind: "STAFF", workspace: { name: "north-office" } });
  });

  it("preserves safe active staff records when adjacent membership data is corrupt", () => {
    const decision = resolveAuthorizedWorkspaceDestination([
      member("OWNER", "bad", { slug: {} as string }),
      member("DISPATCHER", "good", { slug: "clean-office" }),
      member("OWNER", "missing", { workspaceId: null as unknown as string }),
    ]);
    expect(decision).toMatchObject({ kind: "STAFF", href: "/app/clean-office/overview" });
  });
});
