import type { ReactNode } from "react";
import { StaffAppShell } from "@/components/product/StaffAppShell";
import { hasAuthenticatedSession } from "@/features/auth/server-session";
import { BranchScopeBar } from "@/features/operations/BranchScopeBar";
import { loadOperationalBranchScope, setOperationalBranchScope } from "@/features/operations/operational-product-runtime";

export default async function StaffWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const signedIn = await hasAuthenticatedSession();
  const branchContext = signedIn ? await loadOperationalBranchScope(workspace) : undefined;

  async function branchScopeAction(formData: FormData) {
    "use server";
    await setOperationalBranchScope(workspace, String(formData.get("branchScope") ?? ""));
  }

  return (
    <StaffAppShell workspace={workspace} signedIn={signedIn}>
      {branchContext?.ok ? (
        <BranchScopeBar
          actor={branchContext.value.actor}
          scope={branchContext.value.branchScope}
          action={branchScopeAction}
        />
      ) : null}
      {children}
    </StaffAppShell>
  );
}
