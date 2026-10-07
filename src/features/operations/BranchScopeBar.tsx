import type { ActorContext } from "@/contracts";
import type { OperationalBranchScope } from "./operational-product-runtime";

export function BranchScopeBar({
  actor,
  scope,
  action,
}: {
  actor: ActorContext;
  scope: OperationalBranchScope;
  action: (formData: FormData) => Promise<void>;
}) {
  if (scope.mode === "LEGACY" || scope.branches.length === 0) return null;

  const selected = scope.mode === "BRANCH"
    ? scope.branches.find((branch) => branch.id === scope.selectedBranchId)
    : undefined;

  return (
    <section className="app-branch-scope" aria-label="Branch scope">
      <div className="app-branch-scope-copy">
        <span className="app-branch-scope-label">{scope.mode === "ALL" ? "HQ view" : "Branch view"}</span>
        <strong>{selected?.name ?? "All branches"}</strong>
        <span>
          {selected
            ? `${selected.code} · ${selected.timezone} · ${selected.currency}`
            : `${scope.branches.length} active branches · company-wide owner scope`}
        </span>
      </div>

      <form action={action} className="app-branch-scope-form">
        <label>
          <span className="app-sr-only">Operational branch scope</span>
          <select name="branchScope" defaultValue={scope.mode === "ALL" ? "ALL" : scope.selectedBranchId}>
            {actor.role === "OWNER" ? <option value="ALL">HQ · All branches</option> : null}
            {scope.branches.map((branch) => (
              <option value={branch.id} key={branch.id}>
                {branch.name} · {branch.code}
              </option>
            ))}
          </select>
        </label>
        <button className="app-button-secondary" type="submit">Apply</button>
      </form>
    </section>
  );
}
