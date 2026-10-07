import { redirect } from "next/navigation";
import {
  selectOperationalBranch,
  type OperationalBranchScope,
} from "./operational-product-runtime";
import styles from "./BranchContextBar.module.css";

export function BranchContextBar({
  workspaceSlug,
  currentModule,
  branchScope,
}: {
  workspaceSlug: string;
  currentModule: string;
  branchScope?: OperationalBranchScope;
}) {
  if (!branchScope?.available || branchScope.branches.length === 0) return null;

  const selected = branchScope.selectedBranchId
    ? branchScope.branches.find((branch) => branch.id === branchScope.selectedBranchId)
    : undefined;

  async function changeBranch(formData: FormData) {
    "use server";
    const branchId = String(formData.get("branchId") ?? "") || undefined;
    const result = await selectOperationalBranch(workspaceSlug, branchId);
    const key = result.ok ? "notice" : "error";
    redirect(
      "/app/" +
        encodeURIComponent(workspaceSlug) +
        "/" +
        currentModule +
        "?" +
        key +
        "=" +
        encodeURIComponent(result.message),
    );
  }

  return (
    <section className={styles.bar} aria-label="Branch context">
      <div className={styles.context}>
        <span className={styles.icon} aria-hidden="true">⌂</span>
        <span>
          <small>{branchScope.ownerGlobalAccess && !selected ? "Company view" : "Branch view"}</small>
          <strong>{selected?.name ?? "All branches"}</strong>
        </span>
        {selected ? (
          <span className={styles.meta}>
            {selected.code} · {selected.timezone} · {selected.currency}
          </span>
        ) : (
          <span className={styles.meta}>
            {branchScope.branches.filter((branch) => branch.active).length} active branches
          </span>
        )}
      </div>

      <form action={changeBranch} className={styles.form}>
        <label>
          <span className="app-sr-only">Active branch</span>
          <select
            className="app-input"
            name="branchId"
            defaultValue={branchScope.selectedBranchId ?? ""}
          >
            {branchScope.ownerGlobalAccess ? <option value="">All branches</option> : null}
            {branchScope.branches
              .filter((branch) => branch.active)
              .map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </option>
              ))}
          </select>
        </label>
        <button className="app-button-secondary" type="submit">Switch</button>
      </form>
    </section>
  );
}
