"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./StaffSubmitButton.module.css";

/**
 * Shows true React 19 form-submission status for authenticated server actions.
 * Never infers success, mutates local business state or retries paid operations.
 * Native name/value/disabled attributes are preserved for multi-action forms.
 */
export function StaffSubmitButton({
  children,
  disabled,
  pendingLabel = "Submitting…",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children"> & {
  children: ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      type="submit"
      disabled={Boolean(disabled || pending)}
      aria-busy={pending || undefined}
    >
      <span className={styles.label}>{pending ? pendingLabel : children}</span>
      <span className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {pending ? pendingLabel : ""}
      </span>
    </button>
  );
}
