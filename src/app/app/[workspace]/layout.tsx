import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { STUDIO_RETURN_HEADER, verifiedStudioSignInTarget } from "@/features/auth/studio-return-target";
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
  // Rendering the whole staff rail to a guest makes a failed login look
  // superficially authenticated. Always gate the Studio at the server
  // boundary, before fetching workspace or branch information.
  if (!signedIn) {
    const requestHeaders = await headers();
    const target = verifiedStudioSignInTarget(workspace, requestHeaders.get(STUDIO_RETURN_HEADER));
    redirect("/auth/sign-in?next=" + encodeURIComponent(target));
  }
  const branchContext = await loadOperationalBranchScope(workspace);

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
