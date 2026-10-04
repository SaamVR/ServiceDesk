import type { ReactNode } from "react";
import { StaffAppShell } from "@/components/product/StaffAppShell";

export default async function StaffWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  return <StaffAppShell workspace={workspace}>{children}</StaffAppShell>;
}
