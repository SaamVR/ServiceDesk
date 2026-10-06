import type { ReactNode } from "react";
import { StaffAppShell } from "@/components/product/StaffAppShell";
import { hasAuthenticatedSession } from "@/features/auth/server-session";

export default async function StaffWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const signedIn = await hasAuthenticatedSession();
  return <StaffAppShell workspace={workspace} signedIn={signedIn}>{children}</StaffAppShell>;
}
