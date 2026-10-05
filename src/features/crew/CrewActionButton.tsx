"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

export interface CrewActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pendingLabel?: string;
}

export function CrewActionButton({
  children,
  pendingLabel = "Saving…",
  disabled,
  ...props
}: CrewActionButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button {...props} disabled={disabled || pending} aria-disabled={disabled || pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
